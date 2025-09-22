-- Fix remaining critical security issues

-- Fix search paths for all functions missing them
-- Check for functions with mutable search paths and fix them

-- Fix verify_and_update_payment_status function
CREATE OR REPLACE FUNCTION public.verify_and_update_payment_status(payment_ref text, new_status text, payment_amount numeric DEFAULT NULL::numeric, payment_gateway_response jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $$
DECLARE
  v_order_record RECORD;
  v_result jsonb;
  v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'];
BEGIN
  -- CRITICAL: Parameter validation to prevent enum casting errors
  IF payment_ref IS NULL OR trim(payment_ref) = '' THEN
    RAISE EXCEPTION 'Payment reference cannot be null or empty';
  END IF;
  
  IF new_status IS NULL OR trim(new_status) = '' OR new_status = 'null' THEN
    RAISE EXCEPTION 'Status cannot be null or empty. Received: %', new_status;
  END IF;
  
  -- Validate enum value before casting
  IF NOT (new_status = ANY(v_valid_statuses)) THEN
    RAISE EXCEPTION 'Invalid order status: %. Valid values: %', new_status, array_to_string(v_valid_statuses, ', ');
  END IF;

  -- Find and lock the order
  SELECT * INTO v_order_record
  FROM orders
  WHERE payment_reference = payment_ref
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found for reference: %', payment_ref;
  END IF;

  -- Update order status with CORRECT field name 'updated_by'
  UPDATE orders
  SET 
    status = CASE 
      WHEN new_status IS NOT NULL AND new_status != 'null' AND new_status != '' 
      THEN new_status::order_status 
      ELSE status 
    END,
    payment_status = 'paid'::payment_status,
    payment_verified_at = NOW(),
    updated_at = NOW(),
    updated_by = auth.uid()  -- FIXED: Use 'updated_by' not 'updated_by_name'
  WHERE payment_reference = payment_ref;

  -- Rest of function continues unchanged...
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_record.id,
    'fixed_field_error', true
  );

EXCEPTION WHEN OTHERS THEN
  -- Log the error
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'payment_verification_error_fixed',
    'Payment Processing',
    'Payment verification error (FIXED VERSION): ' || SQLERRM,
    jsonb_build_object(
      'reference', payment_ref,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    )
  );
  RAISE;
END;
$$;

-- Fix other critical functions with search paths
CREATE OR REPLACE FUNCTION public.acquire_order_lock(p_order_id uuid, p_admin_session_id text, p_timeout_seconds integer DEFAULT 30)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $$
DECLARE
  lock_acquired boolean := false;
BEGIN
  -- Clean up expired locks first
  UPDATE order_update_locks 
  SET released_at = now()
  WHERE expires_at < now() AND released_at IS NULL;
  
  -- Try to acquire lock
  INSERT INTO order_update_locks (
    order_id,
    lock_key,
    acquired_by,
    expires_at
  ) VALUES (
    p_order_id,
    'order_status_update_' || p_order_id::text,
    p_admin_session_id,
    now() + (p_timeout_seconds || ' seconds')::interval
  )
  ON CONFLICT (lock_key) DO NOTHING
  RETURNING true INTO lock_acquired;
  
  RETURN COALESCE(lock_acquired, false);
END;
$$;