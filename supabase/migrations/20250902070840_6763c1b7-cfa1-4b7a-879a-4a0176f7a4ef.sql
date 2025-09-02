-- CRITICAL EMAIL SECURITY FIXES FOR PRODUCTION (Fixed)

-- 1. Fix communication_settings_archive RLS (CRITICAL - currently no RLS)
ALTER TABLE IF EXISTS public.communication_settings_archive ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DO $$ 
BEGIN
  -- Drop existing policies on communication_settings_archive
  DROP POLICY IF EXISTS "Admins can view communication settings archive" ON public.communication_settings_archive;
  DROP POLICY IF EXISTS "Service roles can manage communication settings archive" ON public.communication_settings_archive;
  
  -- Drop existing policies on email tables 
  DROP POLICY IF EXISTS "Admins can manage email suppressions" ON public.email_suppression_list;
  DROP POLICY IF EXISTS "Service roles can manage email suppressions" ON public.email_suppression_list;
  DROP POLICY IF EXISTS "Admins can view email bounces" ON public.email_bounce_tracking;
  DROP POLICY IF EXISTS "Service roles can manage email bounces" ON public.email_bounce_tracking;
  DROP POLICY IF EXISTS "Admins can view email unsubscribes" ON public.email_unsubscribes;
  DROP POLICY IF EXISTS "Service roles can manage email unsubscribes" ON public.email_unsubscribes;
END $$;

-- Enable RLS on email security tables
ALTER TABLE IF EXISTS public.email_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_bounce_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Create new secure policies
CREATE POLICY "Admins can view communication settings archive" 
ON public.communication_settings_archive 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Service roles can manage communication settings archive" 
ON public.communication_settings_archive 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

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