-- CRITICAL EMAIL SECURITY FIXES FOR PRODUCTION

-- 1. Fix communication_settings_archive RLS (CRITICAL - currently no RLS)
ALTER TABLE public.communication_settings_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view communication settings archive" 
ON public.communication_settings_archive 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Service roles can manage communication settings archive" 
ON public.communication_settings_archive 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 2. Secure email suppression and bounce tracking tables
ALTER TABLE public.email_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_bounce_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Email suppression policies
CREATE POLICY "Admins can manage email suppressions" 
ON public.email_suppression_list 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Service roles can manage email suppressions" 
ON public.email_suppression_list 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Email bounce tracking policies  
CREATE POLICY "Admins can view email bounces" 
ON public.email_bounce_tracking 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Service roles can manage email bounces" 
ON public.email_bounce_tracking 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Email unsubscribes policies
CREATE POLICY "Admins can view email unsubscribes" 
ON public.email_unsubscribes 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Service roles can manage email unsubscribes" 
ON public.email_unsubscribes 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 3. Add email security audit function
CREATE OR REPLACE FUNCTION public.log_email_security_event(
  p_event_type TEXT,
  p_email_address TEXT,
  p_function_name TEXT,
  p_details JSONB DEFAULT '{}'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    new_values
  ) VALUES (
    p_event_type,
    'Email Security',
    format('Email security event in %s: %s', p_function_name, p_email_address),
    auth.uid(),
    p_details || jsonb_build_object(
      'function', p_function_name,
      'email', p_email_address,
      'timestamp', NOW()
    )
  );
END;
$$;

-- 4. Create secure email cleanup function (admin-only)
CREATE OR REPLACE FUNCTION public.admin_email_cleanup(
  p_days_old INTEGER DEFAULT 30
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  
AS $$
DECLARE
  v_cleaned_events INTEGER := 0;
  v_cleaned_logs INTEGER := 0;
BEGIN
  -- Only admins can run cleanup
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Archive old communication events
  WITH archived AS (
    INSERT INTO communication_events_archive
    SELECT * FROM communication_events 
    WHERE created_at < NOW() - (p_days_old || ' days')::INTERVAL 
    AND status IN ('sent', 'failed')
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_cleaned_events FROM archived;

  -- Delete archived events
  DELETE FROM communication_events 
  WHERE created_at < NOW() - (p_days_old || ' days')::INTERVAL 
  AND status IN ('sent', 'failed');

  -- Clean old SMTP logs
  DELETE FROM smtp_delivery_confirmations 
  WHERE created_at < NOW() - (p_days_old || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_cleaned_logs = ROW_COUNT;

  -- Log the cleanup
  PERFORM log_email_security_event(
    'email_cleanup_executed',
    'system',
    'admin_email_cleanup',
    jsonb_build_object(
      'days_old', p_days_old,
      'events_cleaned', v_cleaned_events,
      'logs_cleaned', v_cleaned_logs
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'events_cleaned', v_cleaned_events,
    'logs_cleaned', v_cleaned_logs,
    'days_old', p_days_old
  );
END;
$$;