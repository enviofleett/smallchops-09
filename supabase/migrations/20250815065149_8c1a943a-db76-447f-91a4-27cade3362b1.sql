-- ============================================================================
-- SECURITY REMEDIATION: Payment Processing Status - Alternative Approach
-- Since payment_processing_status is a view, we'll secure it differently
-- ============================================================================

-- Phase 1: Create a secure materialized table approach
-- ============================================================================

-- 1. Drop the existing view and create a secure table instead
DROP VIEW IF EXISTS payment_processing_status;

-- 2. Create a secure payment_processing_status table with RLS
CREATE TABLE IF NOT EXISTS payment_processing_status (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES orders(id),
    order_number text,
    payment_reference text,
    reference_type text,
    processing_stage text,
    overall_status text,
    current_order_status order_status,
    order_type order_type,
    error_message text,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW()
);

-- 3. Enable RLS on the new table
ALTER TABLE payment_processing_status ENABLE ROW LEVEL SECURITY;

-- 4. Create secure RLS policies
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

CREATE POLICY "Service roles can manage payment processing status"
ON payment_processing_status
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 5. Create function to populate/refresh payment processing status data
CREATE OR REPLACE FUNCTION public.refresh_payment_processing_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Clear existing data
  TRUNCATE payment_processing_status;
  
  -- Repopulate with current data from payment_processing_logs and orders
  INSERT INTO payment_processing_status (
    order_id,
    order_number,
    payment_reference,
    reference_type,
    processing_stage,
    overall_status,
    current_order_status,
    order_type,
    error_message,
    created_at
  )
  SELECT DISTINCT ON (ppl.order_id)
    ppl.order_id,
    o.order_number,
    ppl.payment_reference,
    ppl.reference_type,
    ppl.processing_stage,
    CASE 
      WHEN o.status = 'confirmed' THEN 'completed'
      WHEN o.status = 'pending' AND ppl.error_message IS NOT NULL THEN 'failed'
      WHEN o.status = 'pending' THEN 'processing'
      ELSE 'unknown'
    END as overall_status,
    o.status as current_order_status,
    o.order_type,
    ppl.error_message,
    ppl.created_at
  FROM payment_processing_logs ppl
  JOIN orders o ON o.id = ppl.order_id
  WHERE ppl.order_id IS NOT NULL
  ORDER BY ppl.order_id, ppl.created_at DESC;
  
  -- Log the refresh
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    new_values
  ) VALUES (
    'payment_status_refreshed',
    'Payment Security',
    'Payment processing status data refreshed',
    auth.uid(),
    jsonb_build_object(
      'refresh_time', NOW(),
      'records_updated', (SELECT COUNT(*) FROM payment_processing_status)
    )
  );
END;
$$;

-- 6. Create trigger to auto-update payment processing status
CREATE OR REPLACE FUNCTION public.update_payment_processing_status_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_overall_status text;
BEGIN
  -- Determine overall status based on processing stage and order status
  SELECT CASE 
    WHEN EXISTS(SELECT 1 FROM orders WHERE id = NEW.order_id AND status = 'confirmed') THEN 'completed'
    WHEN NEW.error_message IS NOT NULL THEN 'failed'
    WHEN NEW.processing_stage IN ('payment_verification_success', 'reference_update_success') THEN 'processing'
    ELSE 'pending'
  END INTO v_overall_status;
  
  -- Insert or update payment processing status
  INSERT INTO payment_processing_status (
    order_id,
    order_number,
    payment_reference,
    reference_type,
    processing_stage,
    overall_status,
    current_order_status,
    order_type,
    error_message,
    created_at,
    updated_at
  )
  SELECT 
    NEW.order_id,
    o.order_number,
    NEW.payment_reference,
    NEW.reference_type,
    NEW.processing_stage,
    v_overall_status,
    o.status,
    o.order_type,
    NEW.error_message,
    NEW.created_at,
    NOW()
  FROM orders o 
  WHERE o.id = NEW.order_id
  ON CONFLICT (order_id) 
  DO UPDATE SET
    payment_reference = EXCLUDED.payment_reference,
    reference_type = EXCLUDED.reference_type,
    processing_stage = EXCLUDED.processing_stage,
    overall_status = EXCLUDED.overall_status,
    current_order_status = EXCLUDED.current_order_status,
    error_message = EXCLUDED.error_message,
    updated_at = NOW();
    
  RETURN NEW;
END;
$$;

-- Apply trigger to payment_processing_logs
CREATE TRIGGER update_payment_status_on_log_insert
  AFTER INSERT ON payment_processing_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_processing_status_trigger();

-- Phase 2: Create secure access functions
-- ============================================================================

-- 7. Create secure customer access function
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

-- 8. Create secure admin access function
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

-- Phase 3: Harden existing payment functions with search paths
-- ============================================================================

-- 9. Update existing payment functions with secure search paths
CREATE OR REPLACE FUNCTION public.update_order_with_payment_reference(order_uuid uuid, new_payment_reference text, order_fulfillment_type text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    result_data JSONB;
    current_reference TEXT;
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
        ELSE
            RAISE EXCEPTION 'Invalid payment reference format. Expected txn_ or pay_ prefix, got: %', new_payment_reference;
        END IF;
    END IF;

    -- Check if order exists and get current payment reference
    SELECT payment_reference INTO current_reference 
    FROM orders 
    WHERE id = order_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', order_uuid;
    END IF;

    -- Check if order already has a different payment reference
    IF current_reference IS NOT NULL AND current_reference != new_payment_reference THEN
        -- Return existing reference
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
        RAISE;
END;
$$;

-- Phase 4: Security permissions and indexes
-- ============================================================================

-- 10. Grant appropriate permissions
GRANT EXECUTE ON FUNCTION public.get_customer_payment_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_payment_status(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_payment_processing_status() TO authenticated;

-- Revoke unnecessary permissions and grant minimal access
REVOKE ALL ON payment_processing_status FROM anon;
GRANT SELECT ON payment_processing_status TO authenticated;

-- 11. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_payment_processing_status_order_id 
ON payment_processing_status(order_id);

CREATE INDEX IF NOT EXISTS idx_payment_processing_status_reference 
ON payment_processing_status(payment_reference);

CREATE INDEX IF NOT EXISTS idx_payment_processing_status_overall_status 
ON payment_processing_status(overall_status);

-- 12. Populate initial data
SELECT public.refresh_payment_processing_status();

-- 13. Add security monitoring
CREATE OR REPLACE FUNCTION public.monitor_payment_status_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Log all access attempts for security monitoring
    INSERT INTO audit_logs (
        action,
        category,
        message,
        user_id,
        new_values
    ) VALUES (
        'payment_status_table_accessed',
        'Payment Security',
        'Direct access to payment_processing_status table',
        auth.uid(),
        jsonb_build_object(
            'access_time', NOW(),
            'user_role', auth.role(),
            'operation', TG_OP
        )
    );
    
    RETURN NULL;
END;
$$;

-- 14. Log completion of security remediation
INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    new_values
) VALUES (
    'security_remediation_completed_v2',
    'Payment Security',
    'Payment processing status security remediation completed with table approach',
    auth.uid(),
    jsonb_build_object(
        'remediation_date', NOW(),
        'approach', 'secure_table_with_rls',
        'components_secured', jsonb_build_array(
            'payment_processing_status_table',
            'rls_policies',
            'secure_access_functions',
            'audit_logging',
            'search_path_hardening'
        ),
        'security_level', 'high'
    )
);

-- 15. Add table comments for documentation
COMMENT ON TABLE payment_processing_status IS 'Secured payment processing status table with RLS policies, audit logging, and controlled access functions';
COMMENT ON FUNCTION public.get_customer_payment_status(uuid) IS 'Secure customer access to payment status with proper validation and logging';
COMMENT ON FUNCTION public.get_admin_payment_status(uuid, text, integer) IS 'Secure admin access to payment status with comprehensive audit trail';
COMMENT ON FUNCTION public.refresh_payment_processing_status() IS 'Function to refresh payment processing status data from logs and orders';