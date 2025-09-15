-- PHASE 1: CRITICAL PRODUCTION READINESS FIXES (FINAL)
-- Fix 1: Implement missing RLS policies on critical tables

-- Enable RLS and create policies for customer_otp_codes (using correct column names)
ALTER TABLE public.customer_otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_can_access_own_otp_codes" ON public.customer_otp_codes
    FOR ALL 
    USING (auth.uid() IS NOT NULL AND lower(email) = lower(current_user_email()))
    WITH CHECK (auth.uid() IS NOT NULL AND lower(email) = lower(current_user_email()));

CREATE POLICY "admins_can_manage_otp_codes" ON public.customer_otp_codes
    FOR ALL 
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "service_role_can_manage_otp_codes" ON public.customer_otp_codes
    FOR ALL 
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Fix 2: Clear stuck email queue and update failed emails
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

-- Fix 3: Create cleanup function for regular maintenance
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

-- Fix 4: Update remaining function security paths
CREATE OR REPLACE FUNCTION public.activate_admin_user(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_user RECORD;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Get target user info
  SELECT * INTO target_user FROM profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Update user status
  UPDATE profiles
  SET is_active = true, updated_at = NOW()
  WHERE id = p_user_id;

  -- Log the action
  INSERT INTO audit_logs (
    action, category, message, user_id, entity_id, old_values, new_values
  ) VALUES (
    'admin_user_activated',
    'User Management',
    'Admin user activated: ' || target_user.email,
    auth.uid(),
    p_user_id,
    json_build_object('is_active', target_user.is_active),
    json_build_object('is_active', true)
  );

  RETURN json_build_object('success', true, 'message', 'User activated successfully');
END;
$function$;

CREATE OR REPLACE FUNCTION public.deactivate_admin_user(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_user RECORD;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Get target user info
  SELECT * INTO target_user FROM profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Prevent self-deactivation
  IF p_user_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Cannot deactivate yourself');
  END IF;

  -- Update user status
  UPDATE profiles
  SET is_active = false, updated_at = NOW()
  WHERE id = p_user_id;

  -- Log the action
  INSERT INTO audit_logs (
    action, category, message, user_id, entity_id, old_values, new_values
  ) VALUES (
    'admin_user_deactivated',
    'User Management',
    'Admin user deactivated: ' || target_user.email,
    auth.uid(),
    p_user_id,
    json_build_object('is_active', target_user.is_active),
    json_build_object('is_active', false)
  );

  RETURN json_build_object('success', true, 'message', 'User deactivated successfully');
END;
$function$;