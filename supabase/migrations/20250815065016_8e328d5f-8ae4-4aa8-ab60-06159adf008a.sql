-- ============================================================================
-- SECURITY REMEDIATION: Payment Processing Status View and Related Functions
-- ============================================================================

-- Phase 1: Immediate Critical Security Fixes
-- ============================================================================

-- 1. Enable RLS on payment_processing_status view
ALTER TABLE payment_processing_status ENABLE ROW LEVEL SECURITY;

-- 2. Create secure RLS policies for payment_processing_status
CREATE POLICY "Admins can view all payment processing status"
ON payment_processing_status
FOR SELECT
USING (is_admin());

CREATE POLICY "Customers can view their own payment status"
ON payment_processing_status
FOR SELECT
USING (
  order_id IN (
    SELECT o.id FROM orders o
    WHERE (
      -- Customer owns this order via customer_accounts
      o.customer_id IN (
        SELECT ca.id FROM customer_accounts ca WHERE ca.user_id = auth.uid()
      )
      OR
      -- Guest order email match
      (o.customer_email IS NOT NULL AND o.customer_email IN (
        SELECT u.email FROM auth.users u WHERE u.id = auth.uid()
      ))
    )
  )
);

CREATE POLICY "Service roles can view payment processing status"
ON payment_processing_status
FOR SELECT
USING (auth.role() = 'service_role');

-- 3. Create secure access functions with proper validation
CREATE OR REPLACE FUNCTION public.get_customer_payment_status(p_order_id uuid)
RETURNS TABLE(
  order_id uuid,
  order_number text,
  payment_reference text,
  processing_stage text,
  overall_status text,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_order_record record;
BEGIN
  -- Get authenticated user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Validate order access
  SELECT o.* INTO v_order_record
  FROM orders o
  WHERE o.id = p_order_id
  AND (
    o.customer_id IN (
      SELECT ca.id FROM customer_accounts ca WHERE ca.user_id = v_user_id
    )
    OR
    (o.customer_email IS NOT NULL AND o.customer_email IN (
      SELECT u.email FROM auth.users u WHERE u.id = v_user_id
    ))
  );
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;
  
  -- Log access attempt
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values
  ) VALUES (
    'payment_status_accessed',
    'Payment Security',
    'Customer accessed payment status for order: ' || p_order_id,
    v_user_id,
    p_order_id,
    jsonb_build_object('function', 'get_customer_payment_status')
  );
  
  -- Return secure payment status
  RETURN QUERY
  SELECT 
    pps.order_id,
    pps.order_number,
    pps.payment_reference,
    pps.processing_stage,
    pps.overall_status,
    CASE 
      WHEN pps.error_message IS NOT NULL THEN 'Payment processing encountered an issue'
      ELSE NULL 
    END as error_message -- Sanitized error message
  FROM payment_processing_status pps
  WHERE pps.order_id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_payment_status(
  p_order_id uuid DEFAULT NULL,
  p_payment_reference text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  order_id uuid,
  order_number text,
  payment_reference text,
  reference_type text,
  processing_stage text,
  overall_status text,
  error_message text,
  created_at timestamp with time zone,
  order_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Validate admin access
  v_user_id := auth.uid();
  
  IF NOT is_admin() THEN
    -- Log unauthorized access attempt
    INSERT INTO security_incidents (
      type,
      description,
      severity,
      user_id,
      created_at
    ) VALUES (
      'unauthorized_admin_access',
      'Non-admin user attempted to access admin payment status function',
      'high',
      v_user_id,
      NOW()
    );
    
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  -- Log admin access
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    new_values
  ) VALUES (
    'admin_payment_status_accessed',
    'Payment Security',
    'Admin accessed payment processing status',
    v_user_id,
    jsonb_build_object(
      'function', 'get_admin_payment_status',
      'order_id', p_order_id,
      'payment_reference', p_payment_reference
    )
  );
  
  -- Return admin payment status with filters
  RETURN QUERY
  SELECT 
    pps.order_id,
    pps.order_number,
    pps.payment_reference,
    pps.reference_type,
    pps.processing_stage,
    pps.overall_status,
    pps.error_message,
    pps.created_at,
    pps.order_type::text
  FROM payment_processing_status pps
  WHERE (p_order_id IS NULL OR pps.order_id = p_order_id)
    AND (p_payment_reference IS NULL OR pps.payment_reference = p_payment_reference)
  ORDER BY pps.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Phase 2: Search Path Security Hardening
-- ============================================================================

-- Fix search paths on all payment-related functions
CREATE OR REPLACE FUNCTION public.update_order_with_payment_reference(order_uuid uuid, new_payment_reference text, order_fulfillment_type text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    result_data JSONB;
    order_exists BOOLEAN DEFAULT FALSE;
    current_reference TEXT;
    reference_prefix TEXT;
BEGIN
    -- Input validation
    IF order_uuid IS NULL THEN
        RAISE EXCEPTION 'Order ID cannot be null';
    END IF;
    
    IF new_payment_reference IS NULL OR LENGTH(TRIM(new_payment_reference)) = 0 THEN
        RAISE EXCEPTION 'Payment reference cannot be null or empty';
    END IF;

    -- Log the attempt with security context
    INSERT INTO payment_processing_logs (
        order_id, 
        payment_reference, 
        reference_type,
        fulfillment_type,
        processing_stage,
        metadata
    ) VALUES (
        order_uuid,
        new_payment_reference,
        CASE 
            WHEN new_payment_reference LIKE 'txn_%' THEN 'transaction'
            WHEN new_payment_reference LIKE 'pay_%' THEN 'payment'
            ELSE 'unknown'
        END,
        order_fulfillment_type,
        'reference_update_attempt',
        jsonb_build_object(
            'function_called', 'update_order_with_payment_reference',
            'user_id', auth.uid(),
            'timestamp', NOW()
        )
    );

    -- Validate reference format - ensure it's txn_ format
    IF new_payment_reference NOT LIKE 'txn_%' THEN
        -- Convert pay_ to txn_ format if needed
        IF new_payment_reference LIKE 'pay_%' THEN
            new_payment_reference := 'txn_' || substring(new_payment_reference from 5);
            
            INSERT INTO payment_processing_logs (
                order_id, 
                payment_reference,
                reference_type,
                processing_stage,
                metadata
            ) VALUES (
                order_uuid,
                new_payment_reference,
                'transaction_converted',
                'reference_format_conversion',
                jsonb_build_object(
                    'original_format', 'pay_', 
                    'converted_format', 'txn_',
                    'user_id', auth.uid()
                )
            );
        ELSE
            RAISE EXCEPTION 'Invalid payment reference format. Expected txn_ or pay_ prefix, got: %', new_payment_reference;
        END IF;
    END IF;

    -- Check if order exists and get current payment reference
    SELECT payment_reference INTO current_reference 
    FROM orders 
    WHERE id = order_uuid;
    
    IF NOT FOUND THEN
        INSERT INTO payment_processing_logs (
            order_id, 
            payment_reference,
            processing_stage,
            error_message
        ) VALUES (
            order_uuid,
            new_payment_reference,
            'reference_update_failed',
            'Order not found'
        );
        RAISE EXCEPTION 'Order not found: %', order_uuid;
    END IF;

    -- Check if order already has a payment reference
    IF current_reference IS NOT NULL AND current_reference != new_payment_reference THEN
        INSERT INTO payment_processing_logs (
            order_id, 
            payment_reference,
            processing_stage,
            error_message,
            metadata
        ) VALUES (
            order_uuid,
            new_payment_reference,
            'reference_update_skipped',
            'Order already has different payment reference',
            jsonb_build_object(
                'existing_reference', current_reference,
                'user_id', auth.uid()
            )
        );
        
        -- Return existing reference instead of failing
        SELECT jsonb_build_object(
            'success', true,
            'order_id', id,
            'payment_reference', payment_reference,
            'status', status,
            'message', 'Order already has payment reference'
        ) INTO result_data
        FROM orders
        WHERE id = order_uuid;
        
        RETURN result_data;
    END IF;

    -- Update the order
    UPDATE orders 
    SET 
        payment_reference = new_payment_reference,
        updated_at = NOW()
    WHERE id = order_uuid
    RETURNING jsonb_build_object(
        'success', true,
        'order_id', id,
        'payment_reference', payment_reference,
        'status', status,
        'order_type', order_type,
        'message', 'Payment reference updated successfully'
    ) INTO result_data;

    -- Log successful update
    INSERT INTO payment_processing_logs (
        order_id, 
        payment_reference,
        processing_stage,
        metadata
    ) VALUES (
        order_uuid,
        new_payment_reference,
        'reference_update_success',
        jsonb_build_object(
            'updated_at', NOW(),
            'user_id', auth.uid()
        )
    );

    RETURN result_data;
    
EXCEPTION 
    WHEN OTHERS THEN
        -- Log the error with security context
        INSERT INTO payment_processing_logs (
            order_id, 
            payment_reference,
            processing_stage,
            error_message,
            metadata
        ) VALUES (
            order_uuid,
            new_payment_reference,
            'reference_update_error',
            SQLERRM,
            jsonb_build_object(
                'error_code', SQLSTATE,
                'user_id', auth.uid(),
                'function', 'update_order_with_payment_reference'
            )
        );
        
        -- Re-raise the exception
        RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_and_update_payment_status(payment_ref text, new_status text, payment_amount numeric DEFAULT NULL, payment_gateway_response jsonb DEFAULT NULL)
RETURNS TABLE(order_id uuid, order_number text, status text, amount numeric, customer_email text, order_type text, payment_reference text, updated_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    order_record RECORD;
    normalized_ref TEXT;
    v_user_context jsonb;
BEGIN
    -- Input validation
    IF payment_ref IS NULL OR LENGTH(TRIM(payment_ref)) = 0 THEN
        RAISE EXCEPTION 'Payment reference cannot be null or empty';
    END IF;
    
    IF new_status IS NULL OR LENGTH(TRIM(new_status)) = 0 THEN
        RAISE EXCEPTION 'Payment status cannot be null or empty';
    END IF;

    -- Capture user context for security logging
    v_user_context := jsonb_build_object(
        'user_id', auth.uid(),
        'user_role', auth.role(),
        'timestamp', NOW()
    );

    -- Normalize the payment reference - handle both txn_ and pay_ formats
    normalized_ref := payment_ref;
    
    -- Log payment verification attempt with security context
    INSERT INTO payment_processing_logs (
        payment_reference,
        reference_type,
        processing_stage,
        metadata
    ) VALUES (
        payment_ref,
        CASE 
            WHEN payment_ref LIKE 'txn_%' THEN 'transaction'
            WHEN payment_ref LIKE 'pay_%' THEN 'payment'
            ELSE 'unknown'
        END,
        'payment_verification_attempt',
        jsonb_build_object(
            'new_status', new_status,
            'payment_amount', payment_amount,
            'user_context', v_user_context
        )
    );

    -- Try to find order with exact reference first
    SELECT o.id, o.order_number, o.status, o.total_amount, o.customer_email, 
           o.order_type, o.payment_reference, o.updated_at
    INTO order_record
    FROM orders o
    WHERE o.payment_reference = normalized_ref;

    -- If not found and reference has pay_ prefix, try converting to txn_
    IF order_record.id IS NULL AND payment_ref LIKE 'pay_%' THEN
        normalized_ref := 'txn_' || substring(payment_ref from 5);
        
        SELECT o.id, o.order_number, o.status, o.total_amount, o.customer_email, 
               o.order_type, o.payment_reference, o.updated_at
        INTO order_record
        FROM orders o
        WHERE o.payment_reference = normalized_ref;
        
        INSERT INTO payment_processing_logs (
            payment_reference,
            processing_stage,
            metadata
        ) VALUES (
            payment_ref,
            'reference_normalization',
            jsonb_build_object(
                'normalized_to', normalized_ref,
                'user_context', v_user_context
            )
        );
    END IF;

    -- If still not found, try the reverse (txn_ to pay_)
    IF order_record.id IS NULL AND payment_ref LIKE 'txn_%' THEN
        normalized_ref := 'pay_' || substring(payment_ref from 5);
        
        SELECT o.id, o.order_number, o.status, o.total_amount, o.customer_email, 
               o.order_type, o.payment_reference, o.updated_at
        INTO order_record
        FROM orders o
        WHERE o.payment_reference = normalized_ref;
    END IF;

    IF order_record.id IS NULL THEN
        INSERT INTO payment_processing_logs (
            payment_reference,
            processing_stage,
            error_message,
            metadata
        ) VALUES (
            payment_ref,
            'payment_verification_failed',
            'No order found for payment reference',
            v_user_context
        );
        
        -- Log security incident for missing order
        INSERT INTO security_incidents (
            type,
            description,
            severity,
            reference,
            user_id,
            created_at
        ) VALUES (
            'payment_verification_failed',
            'Payment verification attempted for non-existent order reference',
            'medium',
            payment_ref,
            auth.uid(),
            NOW()
        );
        
        RAISE EXCEPTION 'No order found for payment reference: %', payment_ref;
    END IF;

    -- Check if order is already confirmed
    IF order_record.status = 'confirmed' THEN
        INSERT INTO payment_processing_logs (
            order_id,
            payment_reference,
            processing_stage,
            metadata
        ) VALUES (
            order_record.id,
            payment_ref,
            'payment_verification_skipped',
            jsonb_build_object(
                'reason', 'Order already confirmed',
                'user_context', v_user_context
            )
        );
        
        -- Return existing order details
        RETURN QUERY SELECT 
            order_record.id,
            order_record.order_number,
            order_record.status,
            order_record.total_amount,
            order_record.customer_email,
            order_record.order_type::TEXT,
            order_record.payment_reference,
            order_record.updated_at;
        RETURN;
    END IF;

    -- Validate amount if provided
    IF payment_amount IS NOT NULL AND ABS(payment_amount - order_record.total_amount) > 0.01 THEN
        INSERT INTO security_incidents (
            type,
            description,
            severity,
            reference,
            expected_amount,
            received_amount,
            user_id,
            created_at
        ) VALUES (
            'payment_amount_mismatch',
            'Payment amount verification failed',
            'high',
            payment_ref,
            order_record.total_amount,
            payment_amount,
            auth.uid(),
            NOW()
        );
        
        RAISE EXCEPTION 'Payment amount mismatch. Expected: %, Received: %', order_record.total_amount, payment_amount;
    END IF;

    -- Update the order status
    UPDATE orders
    SET 
        status = new_status::order_status,
        updated_at = NOW(),
        paid_at = CASE WHEN new_status = 'confirmed' THEN NOW() ELSE paid_at END
    WHERE id = order_record.id
    RETURNING 
        id, order_number, status, total_amount, customer_email, order_type, payment_reference, updated_at
    INTO order_record;

    -- Log successful update
    INSERT INTO payment_processing_logs (
        order_id,
        payment_reference,
        processing_stage,
        metadata
    ) VALUES (
        order_record.id,
        payment_ref,
        'payment_verification_success',
        jsonb_build_object(
            'new_status', new_status,
            'order_type', order_record.order_type,
            'user_context', v_user_context
        )
    );

    -- Log audit trail
    INSERT INTO audit_logs (
        action,
        category,
        message,
        user_id,
        entity_id,
        old_values,
        new_values
    ) VALUES (
        'payment_status_verified',
        'Payment Security',
        'Payment status updated for order: ' || order_record.order_number,
        auth.uid(),
        order_record.id,
        jsonb_build_object('old_status', 'pending'),
        jsonb_build_object(
            'new_status', new_status,
            'payment_reference', payment_ref,
            'amount_verified', payment_amount IS NOT NULL
        )
    );

    RETURN QUERY SELECT 
        order_record.id,
        order_record.order_number,
        order_record.status::TEXT,
        order_record.total_amount,
        order_record.customer_email,
        order_record.order_type::TEXT,
        order_record.payment_reference,
        order_record.updated_at;

EXCEPTION 
    WHEN OTHERS THEN
        INSERT INTO payment_processing_logs (
            payment_reference,
            processing_stage,
            error_message,
            metadata
        ) VALUES (
            payment_ref,
            'payment_verification_error',
            SQLERRM,
            jsonb_build_object(
                'error_code', SQLSTATE,
                'user_context', v_user_context,
                'function', 'verify_and_update_payment_status'
            )
        );
        RAISE;
END;
$$;

-- Phase 3: Additional Security Monitoring
-- ============================================================================

-- Create security monitoring trigger for payment processing status access
CREATE OR REPLACE FUNCTION public.log_payment_status_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Log all SELECT operations on payment_processing_status
    INSERT INTO audit_logs (
        action,
        category,
        message,
        user_id,
        new_values
    ) VALUES (
        'payment_status_view_accessed',
        'Payment Security',
        'Payment processing status view accessed',
        auth.uid(),
        jsonb_build_object(
            'access_time', NOW(),
            'user_role', auth.role(),
            'operation', TG_OP
        )
    );
    
    RETURN NULL; -- For AFTER trigger
END;
$$;

-- Apply trigger to monitor access (commented out as triggers on views may not be supported)
-- This would need to be implemented at the application level or through RLS policy logging

-- Phase 4: Grant appropriate permissions
-- ============================================================================

-- Grant usage on functions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_customer_payment_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_payment_status(uuid, text, integer) TO authenticated;

-- Revoke unnecessary permissions
REVOKE ALL ON payment_processing_status FROM anon;
REVOKE ALL ON payment_processing_status FROM authenticated;
GRANT SELECT ON payment_processing_status TO authenticated;

-- Create index for better performance on RLS queries
CREATE INDEX IF NOT EXISTS idx_payment_processing_status_order_customer 
ON payment_processing_status(order_id);

-- Log completion of security remediation
INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    new_values
) VALUES (
    'security_remediation_completed',
    'Payment Security',
    'Payment processing status security remediation completed',
    auth.uid(),
    jsonb_build_object(
        'remediation_date', NOW(),
        'components_secured', jsonb_build_array(
            'payment_processing_status_view',
            'payment_functions',
            'access_controls',
            'audit_logging'
        ),
        'security_level', 'high'
    )
);

COMMENT ON TABLE payment_processing_status IS 'Secured payment processing status view with RLS policies and audit logging';
COMMENT ON FUNCTION public.get_customer_payment_status(uuid) IS 'Secure customer access to payment status with proper validation and logging';
COMMENT ON FUNCTION public.get_admin_payment_status(uuid, text, integer) IS 'Secure admin access to payment status with comprehensive audit trail';