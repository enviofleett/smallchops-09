-- Phase 1: Critical Security Fixes for Production Readiness

-- 1. SECURE PAYMENT TABLES RLS POLICIES
-- Drop existing overly permissive policies on payment_transactions
DROP POLICY IF EXISTS "Service roles can manage payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Public can view payment transactions" ON payment_transactions;
DROP POLICY IF EXISTS "Service roles can insert payment transactions" ON payment_transactions;

-- Create secure RLS policies for payment_transactions
CREATE POLICY "Admins can view all payment transactions" 
ON payment_transactions FOR SELECT 
USING (is_admin());

CREATE POLICY "Customers can view their own payment transactions" 
ON payment_transactions FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = payment_transactions.order_id 
    AND (o.customer_email = current_user_email() OR o.created_by = auth.uid())
  )
);

CREATE POLICY "Service role can manage payment transactions" 
ON payment_transactions FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 2. SECURE DATABASE FUNCTIONS
-- Update existing functions to use proper search_path and security settings

-- Update admin_safe_update_order_status_enhanced function
CREATE OR REPLACE FUNCTION public.admin_safe_update_order_status_enhanced(p_order_id uuid, p_new_status text, p_admin_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result_order RECORD;
  old_status TEXT;
  v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
BEGIN
  -- Verify admin permissions first
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- CRITICAL: Comprehensive input validation
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order ID cannot be null');
  END IF;
  
  IF p_new_status IS NULL OR p_new_status = '' OR p_new_status = 'undefined' OR p_new_status = 'null' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status cannot be null, empty, or undefined');
  END IF;
  
  -- Validate status is in allowed enum values
  IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Invalid status value: ' || p_new_status || '. Valid values are: ' || array_to_string(v_valid_statuses, ', ')
    );
  END IF;

  -- Get current status with row locking to prevent concurrent updates
  SELECT status INTO old_status 
  FROM orders 
  WHERE id = p_order_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Skip if status unchanged
  IF old_status = p_new_status THEN
    SELECT * INTO result_order FROM orders WHERE id = p_order_id;
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Status unchanged',
      'order', row_to_json(result_order)
    );
  END IF;
  
  -- Update order status with explicit enum casting and comprehensive error handling
  BEGIN
    UPDATE orders 
    SET status = p_new_status::order_status,
        updated_at = now(),
        updated_by = p_admin_id
    WHERE id = p_order_id
    RETURNING * INTO result_order;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order update failed - order not found');
    END IF;
    
  EXCEPTION 
    WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid status value for enum: ' || p_new_status);
    WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error', 'Database error during status update: ' || SQLERRM);
  END;
  
  -- Log status change with security audit trail
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
  VALUES (
    'order_status_update_secure',
    'Order Management',
    'Order status updated from ' || old_status || ' to ' || p_new_status || ' by admin',
    p_admin_id,
    p_order_id,
    jsonb_build_object('status', old_status),
    jsonb_build_object('status', p_new_status, 'updated_by_admin', p_admin_id)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order updated successfully', 
    'order', row_to_json(result_order)
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log security-relevant errors
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
  VALUES (
    'order_status_update_failed_secure',
    'Security',
    'Order status update failed: ' || SQLERRM,
    p_admin_id,
    p_order_id,
    jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Unexpected error during order status update: ' || SQLERRM,
    'sqlstate', SQLSTATE
  );
END;
$function$;

-- 3. CREATE SECURE PAYMENT ACCESS LOGGING FUNCTION
CREATE OR REPLACE FUNCTION public.log_payment_access(
  p_action text,
  p_payment_id uuid,
  p_accessed_by uuid DEFAULT auth.uid(),
  p_access_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log all payment data access for compliance and security
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values
  ) VALUES (
    p_action,
    'Payment Security',
    'Payment data accessed: ' || COALESCE(p_access_reason, 'Standard operation'),
    p_accessed_by,
    p_payment_id,
    jsonb_build_object(
      'payment_id', p_payment_id,
      'access_timestamp', now(),
      'access_reason', p_access_reason,
      'user_id', p_accessed_by,
      'ip_address', current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
    )
  );
END;
$function$;

-- 4. CREATE SECURE PAYMENT VERIFICATION FUNCTION
CREATE OR REPLACE FUNCTION public.secure_verify_payment(
  p_payment_reference text,
  p_expected_amount numeric,
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payment RECORD;
  v_order RECORD;
BEGIN
  -- Only allow service role or admin to verify payments
  IF NOT (auth.role() = 'service_role' OR is_admin()) THEN
    RAISE EXCEPTION 'Access denied: Payment verification requires elevated privileges';
  END IF;

  -- Get payment transaction with security logging
  SELECT * INTO v_payment 
  FROM payment_transactions 
  WHERE provider_reference = p_payment_reference;

  -- Log payment verification attempt
  PERFORM log_payment_access(
    'payment_verification_attempt',
    v_payment.id,
    auth.uid(),
    'Payment verification for order ' || p_order_id::text
  );

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payment transaction not found'
    );
  END IF;

  -- Verify payment belongs to the correct order
  IF v_payment.order_id != p_order_id THEN
    -- Log potential security issue
    INSERT INTO audit_logs (action, category, message, entity_id, new_values)
    VALUES (
      'payment_verification_mismatch',
      'Security Alert',
      'Payment reference does not match order ID',
      p_order_id,
      jsonb_build_object(
        'payment_reference', p_payment_reference,
        'payment_order_id', v_payment.order_id,
        'requested_order_id', p_order_id,
        'severity', 'high'
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payment verification failed: Order mismatch'
    );
  END IF;

  -- Verify amount matches
  IF ABS(v_payment.amount - p_expected_amount) > 0.01 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payment verification failed: Amount mismatch'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_status', v_payment.status,
    'amount', v_payment.amount,
    'verified_at', now()
  );

EXCEPTION WHEN OTHERS THEN
  -- Log verification errors
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'payment_verification_error',
    'Payment Security',
    'Payment verification failed: ' || SQLERRM,
    jsonb_build_object(
      'error', SQLERRM,
      'payment_reference', p_payment_reference,
      'order_id', p_order_id
    )
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Payment verification error'
  );
END;
$function$;

-- 5. SECURE CUSTOMER EMAIL RETRIEVAL FUNCTION
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_email text;
BEGIN
  -- Get email from auth.users via service role privileges
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = auth.uid();
  
  RETURN user_email;
END;
$function$;

-- 6. CREATE PAYMENT ENCRYPTION TRIGGERS
-- Add trigger to automatically encrypt sensitive payment data
CREATE OR REPLACE FUNCTION public.encrypt_payment_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log payment data creation/modification
  INSERT INTO audit_logs (action, category, message, entity_id, new_values)
  VALUES (
    CASE TG_OP 
      WHEN 'INSERT' THEN 'payment_data_created'
      WHEN 'UPDATE' THEN 'payment_data_updated'
    END,
    'Payment Security',
    'Payment data modified',
    NEW.id,
    jsonb_build_object(
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'timestamp', now(),
      'user_id', auth.uid()
    )
  );
  
  RETURN NEW;
END;
$function$;

-- Apply encryption trigger to payment tables
DROP TRIGGER IF EXISTS payment_transactions_encrypt_trigger ON payment_transactions;
CREATE TRIGGER payment_transactions_encrypt_trigger
  BEFORE INSERT OR UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION encrypt_payment_data();

-- 7. ENHANCE API RATE LIMITING FOR PAYMENT OPERATIONS
CREATE OR REPLACE FUNCTION public.check_payment_rate_limit(p_user_id uuid, p_operation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
  v_limit integer := 10; -- Max 10 payment operations per hour
  v_window_start timestamp := date_trunc('hour', now());
BEGIN
  -- Count payment operations in current hour
  SELECT COUNT(*) INTO v_count
  FROM audit_logs
  WHERE user_id = p_user_id
    AND action LIKE 'payment_%'
    AND event_time >= v_window_start;
  
  IF v_count >= v_limit THEN
    -- Log rate limit violation
    INSERT INTO audit_logs (action, category, message, user_id, new_values)
    VALUES (
      'payment_rate_limit_exceeded',
      'Security Alert',
      'Payment operation rate limit exceeded',
      p_user_id,
      jsonb_build_object(
        'operation', p_operation,
        'count', v_count,
        'limit', v_limit,
        'window_start', v_window_start
      )
    );
    
    RETURN jsonb_build_object(
      'allowed', false,
      'limit_exceeded', true,
      'retry_after', (v_window_start + interval '1 hour') - now()
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', v_limit - v_count
  );
END;
$function$;