-- PHASE 1: CRITICAL PRODUCTION READINESS FIXES (CORRECTED)
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