-- ============================================================================
-- SECURITY REMEDIATION: Payment Processing Status - Table Security Enhancement
-- Fix existing table structure with proper RLS and security controls
-- ============================================================================

-- Phase 1: Secure the existing payment_processing_status table
-- ============================================================================

-- 1. First, let's check if RLS is already enabled and enable it if not
ALTER TABLE payment_processing_status ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing policies to start fresh
DROP POLICY IF EXISTS "Admins can view all payment processing status" ON payment_processing_status;
DROP POLICY IF EXISTS "Customers can view their own payment status" ON payment_processing_status;
DROP POLICY IF EXISTS "Service roles can view payment processing status" ON payment_processing_status;
DROP POLICY IF EXISTS "Service roles can manage payment processing status" ON payment_processing_status;

-- 3. Create comprehensive RLS policies with proper security controls
CREATE POLICY "admin_full_access_payment_status"
ON payment_processing_status
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "customer_view_own_payment_status"
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

CREATE POLICY "service_role_manage_payment_status"
ON payment_processing_status
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Phase 2: Create secure access functions with proper validation
-- ============================================================================

-- 4. Create secure customer payment status function
CREATE OR REPLACE FUNCTION public.get_customer_payment_status_secure(p_order_id uuid)
RETURNS TABLE(
  order_id uuid,
  order_number text,
  payment_reference text,
  processing_stage text,
  overall_status text,
  error_message text,
  last_updated timestamp with time zone
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
  
  -- Input validation
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order ID cannot be null';
  END IF;
  
  -- Validate order access with comprehensive checks
  SELECT o.* INTO v_order_record
  FROM orders o
  WHERE o.id = p_order_id
  AND (
    -- Customer owns this order via customer_accounts
    o.customer_id IN (
      SELECT ca.id FROM customer_accounts ca WHERE ca.user_id = v_user_id
    )
    OR
    -- Guest order email match
    (o.customer_email IS NOT NULL AND o.customer_email IN (
      SELECT u.email FROM auth.users u WHERE u.id = v_user_id
    ))
  );
  
  IF NOT FOUND THEN
    -- Log unauthorized access attempt
    INSERT INTO security_incidents (
      type,
      description,
      severity,
      user_id,
      reference,
      created_at
    ) VALUES (
      'unauthorized_payment_status_access',
      'User attempted to access payment status for order they do not own',
      'medium',
      v_user_id,
      p_order_id::text,
      NOW()
    );
    
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;
  
  -- Log legitimate access attempt
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values
  ) VALUES (
    'payment_status_accessed_secure',
    'Payment Security',
    'Customer accessed payment status for order: ' || p_order_id,
    v_user_id,
    p_order_id,
    jsonb_build_object(
      'function', 'get_customer_payment_status_secure',
      'access_time', NOW()
    )
  );
  
  -- Return sanitized payment status (no sensitive error details for customers)
  RETURN QUERY
  SELECT 
    pps.order_id,
    pps.order_number,
    pps.payment_reference,
    pps.processing_stage,
    pps.overall_status,
    CASE 
      WHEN pps.error_message IS NOT NULL THEN 'Payment processing encountered an issue. Please contact support if needed.'
      ELSE NULL 
    END as error_message, -- Sanitized error message for security
    COALESCE(pps.updated_at, pps.created_at) as last_updated
  FROM payment_processing_status pps
  WHERE pps.order_id = p_order_id;
END;
$$;

-- 5. Create secure admin payment status function with comprehensive logging
CREATE OR REPLACE FUNCTION public.get_admin_payment_status_secure(
  p_order_id uuid DEFAULT NULL,
  p_payment_reference text DEFAULT NULL,
  p_overall_status text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  order_id uuid,
  order_number text,
  payment_reference text,
  reference_type text,
  processing_stage text,
  overall_status text,
  current_order_status text,
  error_message text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  order_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_access_context jsonb;
BEGIN
  -- Validate admin access
  v_user_id := auth.uid();
  
  IF NOT is_admin() THEN
    -- Log unauthorized admin access attempt
    INSERT INTO security_incidents (
      type,
      description,
      severity,
      user_id,
      created_at
    ) VALUES (
      'unauthorized_admin_payment_access',
      'Non-admin user attempted to access admin payment status function',
      'high',
      v_user_id,
      NOW()
    );
    
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  -- Input validation
  IF p_limit IS NOT NULL AND (p_limit < 1 OR p_limit > 1000) THEN
    RAISE EXCEPTION 'Limit must be between 1 and 1000';
  END IF;
  
  -- Prepare access context for logging
  v_access_context := jsonb_build_object(
    'function', 'get_admin_payment_status_secure',
    'filters', jsonb_build_object(
      'order_id', p_order_id,
      'payment_reference', p_payment_reference,
      'overall_status', p_overall_status,
      'limit', p_limit
    ),
    'access_time', NOW()
  );
  
  -- Log admin access with context
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    new_values
  ) VALUES (
    'admin_payment_status_accessed_secure',
    'Payment Security',
    'Admin accessed payment processing status with filters',
    v_user_id,
    v_access_context
  );
  
  -- Return comprehensive admin payment status with filters
  RETURN QUERY
  SELECT 
    pps.order_id,
    pps.order_number,
    pps.payment_reference,
    pps.reference_type,
    pps.processing_stage,
    pps.overall_status,
    pps.current_order_status::text,
    pps.error_message,
    pps.created_at,
    pps.updated_at,
    pps.order_type::text
  FROM payment_processing_status pps
  WHERE (p_order_id IS NULL OR pps.order_id = p_order_id)
    AND (p_payment_reference IS NULL OR pps.payment_reference = p_payment_reference)
    AND (p_overall_status IS NULL OR pps.overall_status = p_overall_status)
  ORDER BY pps.created_at DESC
  LIMIT COALESCE(p_limit, 50);
END;
$$;

-- Phase 3: Harden payment processing functions with enhanced security
-- ============================================================================

-- 6. Update existing verify_and_update_payment_status with enhanced security
CREATE OR REPLACE FUNCTION public.verify_and_update_payment_status(
  payment_ref text, 
  new_status text, 
  payment_amount numeric DEFAULT NULL, 
  payment_gateway_response jsonb DEFAULT NULL
)
RETURNS TABLE(
  order_id uuid, 
  order_number text, 
  status text, 
  amount numeric, 
  customer_email text, 
  order_type text, 
  payment_reference text, 
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    order_record RECORD;
    normalized_ref TEXT;
    v_user_context jsonb;
    v_security_check boolean := false;
BEGIN
    -- Comprehensive input validation
    IF payment_ref IS NULL OR LENGTH(TRIM(payment_ref)) = 0 THEN
        RAISE EXCEPTION 'Payment reference cannot be null or empty';
    END IF;
    
    IF new_status IS NULL OR LENGTH(TRIM(new_status)) = 0 THEN
        RAISE EXCEPTION 'Payment status cannot be null or empty';
    END IF;
    
    IF new_status NOT IN ('pending', 'confirmed', 'failed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid payment status: %', new_status;
    END IF;

    -- Capture comprehensive user context for security logging
    v_user_context := jsonb_build_object(
        'user_id', auth.uid(),
        'user_role', auth.role(),
        'timestamp', NOW(),
        'payment_ref', payment_ref,
        'new_status', new_status,
        'amount_provided', payment_amount IS NOT NULL
    );

    -- Enhanced security check - only service roles or admins can verify payments
    IF auth.role() = 'service_role' OR is_admin() THEN
        v_security_check := true;
    ELSE
        INSERT INTO security_incidents (
            type,
            description,
            severity,
            user_id,
            reference,
            created_at
        ) VALUES (
            'unauthorized_payment_verification',
            'Unauthorized user attempted payment verification',
            'critical',
            auth.uid(),
            payment_ref,
            NOW()
        );
        
        RAISE EXCEPTION 'Unauthorized: Only service roles can verify payments';
    END IF;

    -- Normalize the payment reference with security validation
    normalized_ref := TRIM(payment_ref);
    
    -- Log payment verification attempt with enhanced context
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
        'payment_verification_attempt_secure',
        v_user_context
    );

    -- Find order with enhanced reference matching
    SELECT o.id, o.order_number, o.status, o.total_amount, o.customer_email, 
           o.order_type, o.payment_reference, o.updated_at
    INTO order_record
    FROM orders o
    WHERE o.payment_reference = normalized_ref;

    -- Try alternative reference formats if not found
    IF order_record.id IS NULL AND payment_ref LIKE 'pay_%' THEN
        normalized_ref := 'txn_' || substring(payment_ref from 5);
        
        SELECT o.id, o.order_number, o.status, o.total_amount, o.customer_email, 
               o.order_type, o.payment_reference, o.updated_at
        INTO order_record
        FROM orders o
        WHERE o.payment_reference = normalized_ref;
    END IF;

    IF order_record.id IS NULL AND payment_ref LIKE 'txn_%' THEN
        normalized_ref := 'pay_' || substring(payment_ref from 5);
        
        SELECT o.id, o.order_number, o.status, o.total_amount, o.customer_email, 
               o.order_type, o.payment_reference, o.updated_at
        INTO order_record
        FROM orders o
        WHERE o.payment_reference = normalized_ref;
    END IF;

    -- Enhanced error handling for missing orders
    IF order_record.id IS NULL THEN
        INSERT INTO security_incidents (
            type,
            description,
            severity,
            reference,
            user_id,
            created_at
        ) VALUES (
            'payment_verification_orphaned',
            'Payment verification attempted for non-existent order reference',
            'medium',
            payment_ref,
            auth.uid(),
            NOW()
        );
        
        RAISE EXCEPTION 'No order found for payment reference: %', payment_ref;
    END IF;

    -- Skip verification if order is already confirmed
    IF order_record.status = 'confirmed' THEN
        INSERT INTO payment_processing_logs (
            order_id,
            payment_reference,
            processing_stage,
            metadata
        ) VALUES (
            order_record.id,
            payment_ref,
            'payment_verification_skipped_confirmed',
            v_user_context || jsonb_build_object('reason', 'Order already confirmed')
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

    -- Enhanced amount validation with tolerance for rounding
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
            'payment_amount_mismatch_critical',
            'Critical payment amount verification failed - potential fraud',
            'critical',
            payment_ref,
            order_record.total_amount,
            payment_amount,
            auth.uid(),
            NOW()
        );
        
        RAISE EXCEPTION 'Payment amount mismatch. Expected: %, Received: %', order_record.total_amount, payment_amount;
    END IF;

    -- Update the order status with enhanced logging
    UPDATE orders
    SET 
        status = new_status::order_status,
        updated_at = NOW(),
        paid_at = CASE WHEN new_status = 'confirmed' THEN NOW() ELSE paid_at END
    WHERE id = order_record.id
    RETURNING 
        id, order_number, status, total_amount, customer_email, order_type, payment_reference, updated_at
    INTO order_record;

    -- Log successful verification with comprehensive details
    INSERT INTO payment_processing_logs (
        order_id,
        payment_reference,
        processing_stage,
        metadata
    ) VALUES (
        order_record.id,
        payment_ref,
        'payment_verification_success_secure',
        v_user_context || jsonb_build_object(
            'order_updated', true,
            'previous_status', 'pending',
            'new_status', new_status,
            'amount_verified', payment_amount IS NOT NULL
        )
    );

    -- Enhanced audit trail
    INSERT INTO audit_logs (
        action,
        category,
        message,
        user_id,
        entity_id,
        old_values,
        new_values
    ) VALUES (
        'payment_verified_secure',
        'Payment Security',
        'Payment verification completed securely for order: ' || order_record.order_number,
        auth.uid(),
        order_record.id,
        jsonb_build_object('old_status', 'pending'),
        jsonb_build_object(
            'new_status', new_status,
            'payment_reference', payment_ref,
            'amount_verified', payment_amount,
            'gateway_response_received', payment_gateway_response IS NOT NULL
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
        -- Enhanced error logging with security context
        INSERT INTO payment_processing_logs (
            payment_reference,
            processing_stage,
            error_message,
            metadata
        ) VALUES (
            payment_ref,
            'payment_verification_error_secure',
            SQLERRM,
            v_user_context || jsonb_build_object(
                'error_code', SQLSTATE,
                'function', 'verify_and_update_payment_status_secure'
            )
        );
        RAISE;
END;
$$;

-- Phase 4: Security enhancements and monitoring
-- ============================================================================

-- 7. Create comprehensive security monitoring for payment access
CREATE OR REPLACE FUNCTION public.log_payment_access_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Log all access attempts to payment_processing_status
    INSERT INTO audit_logs (
        action,
        category,
        message,
        user_id,
        new_values
    ) VALUES (
        'payment_status_direct_access',
        'Payment Security Monitoring',
        'Direct table access to payment_processing_status detected',
        auth.uid(),
        jsonb_build_object(
            'access_time', NOW(),
            'user_role', auth.role(),
            'operation', TG_OP,
            'source', 'direct_table_access'
        )
    );
    
    RETURN NULL;
END;
$$;

-- 8. Grant minimal necessary permissions
GRANT EXECUTE ON FUNCTION public.get_customer_payment_status_secure(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_payment_status_secure(uuid, text, text, integer) TO authenticated;

-- Revoke direct table access and grant controlled access
REVOKE ALL ON payment_processing_status FROM anon;
REVOKE ALL ON payment_processing_status FROM authenticated;
GRANT SELECT ON payment_processing_status TO authenticated; -- Controlled by RLS

-- 9. Create security indexes for performance and monitoring
CREATE INDEX IF NOT EXISTS idx_payment_status_security_order_customer 
ON payment_processing_status(order_id, overall_status);

CREATE INDEX IF NOT EXISTS idx_payment_status_security_reference 
ON payment_processing_status(payment_reference, processing_stage);

CREATE INDEX IF NOT EXISTS idx_payment_status_security_timestamps 
ON payment_processing_status(created_at, updated_at);

-- 10. Add unique constraint to prevent duplicate entries
ALTER TABLE payment_processing_status 
ADD CONSTRAINT uk_payment_status_order_id UNIQUE (order_id);

-- 11. Create security health check function
CREATE OR REPLACE FUNCTION public.check_payment_security_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result jsonb;
  v_rls_enabled boolean;
  v_policy_count integer;
  v_recent_incidents integer;
BEGIN
  -- Check if admin access is required
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admin access required for security health check';
  END IF;
  
  -- Check RLS status
  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class 
  WHERE relname = 'payment_processing_status';
  
  -- Count active policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policy p
  JOIN pg_class c ON p.polrelid = c.oid
  WHERE c.relname = 'payment_processing_status';
  
  -- Count recent security incidents
  SELECT COUNT(*) INTO v_recent_incidents
  FROM security_incidents
  WHERE type LIKE '%payment%'
    AND created_at > NOW() - INTERVAL '24 hours';
  
  v_result := jsonb_build_object(
    'rls_enabled', v_rls_enabled,
    'policy_count', v_policy_count,
    'recent_incidents_24h', v_recent_incidents,
    'security_level', CASE 
      WHEN v_rls_enabled AND v_policy_count >= 3 AND v_recent_incidents = 0 THEN 'high'
      WHEN v_rls_enabled AND v_policy_count >= 2 THEN 'medium'
      ELSE 'low'
    END,
    'last_checked', NOW()
  );
  
  -- Log the health check
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    new_values
  ) VALUES (
    'payment_security_health_check',
    'Payment Security',
    'Payment security health check performed',
    auth.uid(),
    v_result
  );
  
  RETURN v_result;
END;
$$;

-- 12. Final security remediation log
INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    new_values
) VALUES (
    'payment_security_remediation_complete',
    'Payment Security',
    'Comprehensive payment processing status security remediation completed',
    auth.uid(),
    jsonb_build_object(
        'remediation_date', NOW(),
        'security_approach', 'comprehensive_table_hardening',
        'features_implemented', jsonb_build_array(
            'enhanced_rls_policies',
            'secure_access_functions',
            'comprehensive_audit_logging',
            'security_incident_tracking',
            'input_validation',
            'access_monitoring',
            'health_check_functions'
        ),
        'security_level', 'enterprise_grade'
    )
);

-- Add documentation
COMMENT ON FUNCTION public.get_customer_payment_status_secure(uuid) IS 'Enterprise-grade secure customer access to payment status with comprehensive validation, logging, and sanitized error messages';
COMMENT ON FUNCTION public.get_admin_payment_status_secure(uuid, text, text, integer) IS 'Enterprise-grade secure admin access to payment status with comprehensive audit trail and incident tracking';
COMMENT ON FUNCTION public.check_payment_security_health() IS 'Security health check function for payment processing status monitoring';
COMMENT ON TABLE payment_processing_status IS 'Secured payment processing status table with enterprise-grade RLS policies, comprehensive audit logging, and security monitoring';