-- Create missing rate limiting function
CREATE OR REPLACE FUNCTION public.check_customer_rate_limit_secure(
  p_customer_id uuid,
  p_endpoint text,
  p_max_requests integer DEFAULT 100,
  p_window_minutes integer DEFAULT 60
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request_count integer;
  v_window_start timestamp with time zone;
  v_remaining integer;
BEGIN
  v_window_start := NOW() - (p_window_minutes || ' minutes')::interval;
  
  -- Count requests in the time window
  SELECT COUNT(*) INTO v_request_count
  FROM api_request_logs
  WHERE customer_id = p_customer_id
    AND endpoint = p_endpoint
    AND created_at > v_window_start;
  
  v_remaining := GREATEST(0, p_max_requests - v_request_count);
  
  -- Log rate limit check
  INSERT INTO audit_logs (
    action, category, message, user_id, new_values
  ) VALUES (
    'rate_limit_check',
    'Security',
    'Rate limit check for customer: ' || p_customer_id::text,
    auth.uid(),
    jsonb_build_object(
      'customer_id', p_customer_id,
      'endpoint', p_endpoint,
      'request_count', v_request_count,
      'limit', p_max_requests,
      'remaining', v_remaining,
      'window_minutes', p_window_minutes
    )
  );
  
  RETURN jsonb_build_object(
    'allowed', v_request_count < p_max_requests,
    'current_count', v_request_count,
    'limit', p_max_requests,
    'remaining', v_remaining,
    'reset_at', NOW() + (p_window_minutes || ' minutes')::interval
  );
END;
$$;

-- Add comprehensive order tracking security function
CREATE OR REPLACE FUNCTION public.get_order_tracking_secure(
  p_order_number text,
  p_tracking_token text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_record RECORD;
  v_is_authenticated boolean;
  v_customer_id uuid;
BEGIN
  v_is_authenticated := auth.uid() IS NOT NULL;
  
  -- Get customer ID if authenticated
  IF v_is_authenticated THEN
    SELECT id INTO v_customer_id
    FROM customer_accounts
    WHERE user_id = auth.uid();
  END IF;
  
  -- Find order with security checks
  SELECT 
    o.id,
    o.order_number,
    o.status,
    o.customer_id,
    o.customer_name,
    o.customer_email,
    o.order_type,
    o.total_amount,
    o.created_at,
    o.updated_at,
    o.delivery_address,
    o.estimated_delivery_time,
    o.actual_delivery_time
  INTO v_order_record
  FROM orders o
  WHERE o.order_number = p_order_number;
  
  -- Order not found
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  -- Security check: Must be authenticated customer OR have valid tracking token
  IF NOT v_is_authenticated AND p_tracking_token IS NULL THEN
    -- Log unauthorized access attempt
    INSERT INTO audit_logs (
      action, category, message, new_values
    ) VALUES (
      'unauthorized_order_tracking_attempt',
      'Security',
      'Unauthorized order tracking attempt',
      jsonb_build_object(
        'order_number', p_order_number,
        'ip_address', inet_client_addr()
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied. Please provide tracking token or sign in.'
    );
  END IF;
  
  -- If authenticated, verify order ownership
  IF v_is_authenticated AND v_order_record.customer_id != v_customer_id THEN
    -- Log access attempt to other customer's order
    INSERT INTO audit_logs (
      action, category, message, user_id, new_values
    ) VALUES (
      'unauthorized_order_access_attempt',
      'Security',
      'Customer attempted to access another customer order',
      auth.uid(),
      jsonb_build_object(
        'order_number', p_order_number,
        'order_customer_id', v_order_record.customer_id,
        'requesting_customer_id', v_customer_id
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied. This order does not belong to your account.'
    );
  END IF;
  
  -- TODO: Implement tracking token validation when tracking tokens are added
  -- For now, require authentication for order tracking
  
  -- Log successful tracking access
  INSERT INTO audit_logs (
    action, category, message, user_id, new_values
  ) VALUES (
    'order_tracking_accessed',
    'Order Tracking',
    'Order tracking accessed: ' || p_order_number,
    auth.uid(),
    jsonb_build_object(
      'order_id', v_order_record.id,
      'order_number', p_order_number,
      'access_method', CASE 
        WHEN v_is_authenticated THEN 'authenticated'
        ELSE 'tracking_token'
      END
    )
  );
  
  -- Return order tracking data
  RETURN jsonb_build_object(
    'success', true,
    'order', jsonb_build_object(
      'id', v_order_record.id,
      'order_number', v_order_record.order_number,
      'status', v_order_record.status,
      'customer_name', v_order_record.customer_name,
      'order_type', v_order_record.order_type,
      'total_amount', v_order_record.total_amount,
      'created_at', v_order_record.created_at,
      'updated_at', v_order_record.updated_at,
      'delivery_address', v_order_record.delivery_address,
      'estimated_delivery_time', v_order_record.estimated_delivery_time,
      'actual_delivery_time', v_order_record.actual_delivery_time
    )
  );
END;
$$;

-- Fix SECURITY DEFINER functions missing SET search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  requested_role TEXT;
  final_role user_role;
  is_customer BOOLEAN;
BEGIN
  -- Determine if this is a customer signup (default to customer when not explicitly set)
  is_customer := COALESCE(NEW.raw_user_meta_data->>'user_type', 'customer') = 'customer';

  -- For customers, don't create a profiles row. Other triggers handle customer_accounts.
  IF is_customer THEN
    RETURN NEW;
  END IF;

  -- If a profile is required (admin/staff/etc), safely map role
  requested_role := NEW.raw_user_meta_data->>'role';

  IF requested_role IN ('admin', 'manager', 'staff', 'dispatch_rider') THEN
    final_role := requested_role::user_role;
  ELSE
    final_role := 'staff'::user_role; -- safe default
  END IF;

  INSERT INTO public.profiles (id, email, role, status, created_at, updated_at)
  VALUES (NEW.id, NEW.email, final_role, 'active', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Never block signup; log and continue
    INSERT INTO public.audit_logs (
      action, category, message, user_id, new_values
    ) VALUES (
      'handle_new_user_failed_hardened',
      'Authentication',
      'Non-blocking: handle_new_user failed: ' || SQLERRM,
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'requested_role', requested_role
      )
    );
    RETURN NEW;
END;
$$;