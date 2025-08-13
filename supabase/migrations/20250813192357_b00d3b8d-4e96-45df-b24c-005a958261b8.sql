-- PHASE 1: Complete Database Hardening - Final Security Function Updates
-- Adding SET search_path = 'public' to remaining functions that lack secure search path

-- Fix function search path vulnerabilities for remaining functions
-- These functions currently lack SET search_path = 'public'

-- 1. Handle new user signup function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, 'user', NOW(), NOW());
  RETURN NEW;
END;
$function$;

-- 2. Generate order number function
CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  new_order_number TEXT;
  max_attempts INTEGER := 10;
  attempt_count INTEGER := 0;
BEGIN
  LOOP
    -- Generate order number: ORD + timestamp + random suffix
    new_order_number := 'ORD' || 
                       EXTRACT(EPOCH FROM NOW())::bigint || 
                       substring(gen_random_uuid()::text from 1 for 6);
    
    -- Check if this order number already exists
    IF NOT EXISTS (SELECT 1 FROM orders WHERE order_number = new_order_number) THEN
      RETURN new_order_number;
    END IF;
    
    attempt_count := attempt_count + 1;
    IF attempt_count >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique order number after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$function$;

-- 3. Current user email function
CREATE OR REPLACE FUNCTION public.current_user_email()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT email FROM auth.users WHERE id = auth.uid();
$function$;

-- 4. Log customer operation function
CREATE OR REPLACE FUNCTION public.log_customer_operation(
  p_operation text,
  p_customer_id uuid,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_admin_id uuid DEFAULT NULL::uuid,
  p_ip_address inet DEFAULT NULL::inet,
  p_user_agent text DEFAULT NULL::text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values,
    ip_address,
    user_agent
  ) VALUES (
    'customer_' || p_operation,
    'Customer Management',
    'Customer operation: ' || p_operation,
    COALESCE(p_admin_id, auth.uid()),
    p_customer_id,
    p_details,
    p_ip_address::text,
    p_user_agent
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$function$;

-- 5. Updated timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 6. Handle failed payments function
CREATE OR REPLACE FUNCTION public.handle_failed_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' 
     AND OLD.status IS DISTINCT FROM NEW.status 
     AND NEW.status = 'failed' THEN
    
    -- Log the failed payment
    INSERT INTO audit_logs (
      action,
      category,
      message,
      entity_id,
      new_values
    ) VALUES (
      'payment_failed',
      'Payment Processing',
      'Payment failed for transaction: ' || NEW.provider_reference,
      NEW.id,
      jsonb_build_object(
        'provider_reference', NEW.provider_reference,
        'amount', NEW.amount,
        'currency', NEW.currency,
        'gateway_response', NEW.gateway_response
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 7. Generate unique reference function
CREATE OR REPLACE FUNCTION public.generate_unique_reference(prefix text DEFAULT 'REF'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  new_reference TEXT;
  max_attempts INTEGER := 10;
  attempt_count INTEGER := 0;
BEGIN
  LOOP
    new_reference := prefix || '_' || 
                    EXTRACT(EPOCH FROM NOW())::bigint || '_' || 
                    substring(gen_random_uuid()::text from 1 for 8);
    
    -- Check uniqueness across relevant tables
    IF NOT EXISTS (
      SELECT 1 FROM orders WHERE payment_reference = new_reference
      UNION ALL
      SELECT 1 FROM payment_transactions WHERE provider_reference = new_reference
    ) THEN
      RETURN new_reference;
    END IF;
    
    attempt_count := attempt_count + 1;
    IF attempt_count >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique reference after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$function$;

-- 8. Clean expired sessions function
CREATE OR REPLACE FUNCTION public.clean_expired_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM admin_sessions 
  WHERE expires_at < NOW() OR (last_activity < NOW() - INTERVAL '24 hours');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'session_cleanup',
    'Security',
    'Cleaned expired admin sessions',
    jsonb_build_object('deleted_sessions', deleted_count)
  );
  
  RETURN deleted_count;
END;
$function$;

-- 9. Security audit logging function
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_severity text DEFAULT 'medium'::text,
  p_description text DEFAULT NULL::text,
  p_user_id uuid DEFAULT NULL::uuid,
  p_ip_address inet DEFAULT NULL::inet,
  p_user_agent text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_incident_id UUID;
BEGIN
  INSERT INTO security_incidents (
    type,
    description,
    severity,
    user_id,
    ip_address,
    user_agent,
    request_data,
    created_at
  ) VALUES (
    p_event_type,
    p_description,
    p_severity,
    p_user_id,
    p_ip_address,
    p_user_agent,
    p_metadata,
    NOW()
  ) RETURNING id INTO v_incident_id;
  
  -- Also log to audit logs for comprehensive tracking
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values,
    ip_address,
    user_agent
  ) VALUES (
    'security_event_' || p_event_type,
    'Security',
    'Security event: ' || p_event_type || COALESCE(' - ' || p_description, ''),
    p_user_id,
    v_incident_id,
    p_metadata,
    p_ip_address::text,
    p_user_agent
  );
  
  RETURN v_incident_id;
END;
$function$;

-- 10. Rate limiting check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text,
  p_limit_type text DEFAULT 'general'::text,
  p_max_requests integer DEFAULT 100,
  p_window_minutes integer DEFAULT 60
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_current_count INTEGER;
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_reset_time TIMESTAMP WITH TIME ZONE;
BEGIN
  v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  v_reset_time := DATE_TRUNC('minute', NOW()) + (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Count requests in the current window
  SELECT COUNT(*) INTO v_current_count
  FROM enhanced_rate_limits
  WHERE identifier = p_identifier
    AND limit_type = p_limit_type
    AND window_start > v_window_start;
  
  -- Check if limit exceeded
  IF v_current_count >= p_max_requests THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current_count', v_current_count,
      'limit', p_max_requests,
      'reset_time', v_reset_time,
      'retry_after_seconds', EXTRACT(EPOCH FROM (v_reset_time - NOW()))::integer
    );
  END IF;
  
  -- Record this request
  INSERT INTO enhanced_rate_limits (
    identifier,
    limit_type,
    window_start,
    window_end,
    request_count
  ) VALUES (
    p_identifier,
    p_limit_type,
    DATE_TRUNC('minute', NOW()),
    v_reset_time,
    1
  )
  ON CONFLICT (identifier, limit_type, window_start)
  DO UPDATE SET 
    request_count = enhanced_rate_limits.request_count + 1,
    window_end = v_reset_time;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'current_count', v_current_count + 1,
    'limit', p_max_requests,
    'reset_time', v_reset_time,
    'remaining', p_max_requests - (v_current_count + 1)
  );
END;
$function$;

-- 11. Validate admin permissions function
CREATE OR REPLACE FUNCTION public.validate_admin_permissions(
  p_user_id uuid,
  p_required_permission text
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_has_permission BOOLEAN := false;
BEGIN
  -- Check if user is active admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = p_user_id 
      AND role = 'admin' 
      AND is_active = true
  ) THEN
    RETURN false;
  END IF;
  
  -- Check specific permission
  SELECT EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = p_user_id
      AND menu_key = p_required_permission
      AND permission_level IN ('edit', 'view')
  ) INTO v_has_permission;
  
  -- Log permission check for audit
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    new_values
  ) VALUES (
    'permission_check',
    'Security',
    'Admin permission validation: ' || p_required_permission,
    p_user_id,
    jsonb_build_object(
      'permission', p_required_permission,
      'granted', v_has_permission
    )
  );
  
  RETURN v_has_permission;
END;
$function$;

-- Create comprehensive audit trail for security hardening
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'security_hardening_phase_3_complete',
  'Security',
  'Completed final database security hardening - all functions now have secure search paths',
  jsonb_build_object(
    'functions_hardened', 11,
    'security_functions_added', 4,
    'completion_time', NOW(),
    'remaining_warnings', 'Security definer view, pg_net extension, leaked password protection'
  )
);