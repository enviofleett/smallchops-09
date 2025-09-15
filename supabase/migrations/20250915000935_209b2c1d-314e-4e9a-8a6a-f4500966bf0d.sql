-- PHASE 1: CRITICAL PRODUCTION READINESS FIXES
-- Fix 1: Implement missing RLS policies on critical tables

-- Enable RLS and create policies for customer_otp_codes
ALTER TABLE public.customer_otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_can_access_own_otp_codes" ON public.customer_otp_codes
    FOR ALL 
    USING (auth.uid() IS NOT NULL AND (
        auth.uid()::text = user_id::text OR 
        lower(email) = lower(current_user_email())
    ))
    WITH CHECK (auth.uid() IS NOT NULL AND (
        auth.uid()::text = user_id::text OR 
        lower(email) = lower(current_user_email())
    ));

CREATE POLICY "admins_can_manage_otp_codes" ON public.customer_otp_codes
    FOR ALL 
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "service_role_can_manage_otp_codes" ON public.customer_otp_codes
    FOR ALL 
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Enable RLS and create policies for paystack_secure_config
ALTER TABLE public.paystack_secure_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "only_admins_can_access_paystack_config" ON public.paystack_secure_config
    FOR ALL 
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "service_role_can_access_paystack_config" ON public.paystack_secure_config
    FOR ALL 
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Fix 2: Update function security - Add search_path to critical functions
CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(p_email text, p_ip_address inet DEFAULT NULL::inet)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email_count integer := 0;
  v_ip_count integer := 0;
  v_result jsonb;
  v_time_window timestamp with time zone := now() - interval '1 hour';
BEGIN
  -- Check email-based rate limit (max 3 per hour)
  SELECT COUNT(*) INTO v_email_count
  FROM customer_otp_codes
  WHERE email = p_email
    AND created_at > v_time_window;
    
  -- Check IP-based rate limit (max 10 per hour)
  IF p_ip_address IS NOT NULL THEN
    SELECT COUNT(*) INTO v_ip_count
    FROM customer_otp_codes
    WHERE created_by_ip = p_ip_address
      AND created_at > v_time_window;
  END IF;
  
  v_result := jsonb_build_object(
    'allowed', (v_email_count < 3 AND v_ip_count < 10),
    'email_count', v_email_count,
    'ip_count', v_ip_count,
    'email_limit', 3,
    'ip_limit', 10,
    'window_reset_at', date_trunc('hour', now()) + interval '1 hour'
  );
  
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_customer_record(p_email text, p_name text, p_phone text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_requesting_user_id uuid;
BEGIN
  -- Get the requesting user ID
  v_requesting_user_id := auth.uid();
  
  -- Only allow if user is creating their own record or is admin
  IF p_user_id IS NOT NULL AND p_user_id != v_requesting_user_id THEN
    -- Check if user is admin
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = v_requesting_user_id 
        AND role = 'admin'::user_role 
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Access denied - cannot create customer record for another user';
    END IF;
  END IF;
  
  -- Insert customer record
  INSERT INTO public.customers (
    email,
    name,
    phone,
    user_id
  ) VALUES (
    LOWER(TRIM(p_email)),
    TRIM(p_name),
    CASE WHEN TRIM(p_phone) = '' THEN NULL ELSE TRIM(p_phone) END,
    COALESCE(p_user_id, v_requesting_user_id)
  ) RETURNING id INTO v_customer_id;
  
  -- Log the customer creation
  INSERT INTO public.audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values
  ) VALUES (
    'customer_created',
    'Customer Management',
    'New customer record created',
    v_requesting_user_id,
    v_customer_id,
    jsonb_build_object(
      'email', p_email,
      'name', p_name,
      'phone', p_phone,
      'user_id', COALESCE(p_user_id, v_requesting_user_id)
    )
  );
  
  RETURN v_customer_id;
END;
$function$;

-- Fix 3: Clear stuck email queue and update failed emails
-- First, update stuck emails with proper error messages
UPDATE public.communication_events 
SET 
    status = 'failed',
    error_message = 'Email stuck in queue for over 1 hour - marked as failed for cleanup',
    updated_at = NOW()
WHERE status = 'queued' 
    AND created_at < NOW() - INTERVAL '1 hour'
    AND error_message IS NULL;

-- Update emails that have been processing too long
UPDATE public.communication_events 
SET 
    status = 'failed',
    error_message = 'Email processing timeout - marked as failed',
    updated_at = NOW()
WHERE status = 'processing' 
    AND processing_started_at < NOW() - INTERVAL '30 minutes';

-- Fix 4: Create cleanup function for regular maintenance
CREATE OR REPLACE FUNCTION public.cleanup_stuck_emails()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stuck_count integer := 0;
  v_processing_count integer := 0;
  v_result jsonb;
BEGIN
  -- Clean up emails stuck in queue
  UPDATE public.communication_events 
  SET 
      status = 'failed',
      error_message = 'Email stuck in queue - automatic cleanup',
      updated_at = NOW()
  WHERE status = 'queued' 
      AND created_at < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS v_stuck_count = ROW_COUNT;
  
  -- Clean up emails stuck in processing
  UPDATE public.communication_events 
  SET 
      status = 'failed',
      error_message = 'Email processing timeout - automatic cleanup',
      updated_at = NOW()
  WHERE status = 'processing' 
      AND processing_started_at < NOW() - INTERVAL '30 minutes';
      
  GET DIAGNOSTICS v_processing_count = ROW_COUNT;
  
  -- Log cleanup activity
  INSERT INTO public.audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'email_queue_cleanup',
    'System Maintenance',
    'Automatic cleanup of stuck emails completed',
    jsonb_build_object(
      'stuck_emails_cleaned', v_stuck_count,
      'processing_emails_cleaned', v_processing_count,
      'cleanup_timestamp', NOW()
    )
  );
  
  v_result := jsonb_build_object(
    'success', true,
    'stuck_emails_cleaned', v_stuck_count,
    'processing_emails_cleaned', v_processing_count,
    'total_cleaned', v_stuck_count + v_processing_count
  );
  
  RETURN v_result;
END;
$function$;