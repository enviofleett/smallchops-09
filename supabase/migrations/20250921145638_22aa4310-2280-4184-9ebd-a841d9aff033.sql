-- CRITICAL SECURITY FIXES - Remove dangerous public access policies

-- 1. Remove the dangerous public read policy on business_settings
DROP POLICY IF EXISTS "public_read_business_settings" ON public.business_settings;

-- 2. Remove overly permissive delivery zone policies  
DROP POLICY IF EXISTS "Secure authenticated users view delivery zones" ON public.delivery_zones;

-- 3. Restrict delivery zones to admin-only access
DROP POLICY IF EXISTS "Public can view active delivery zones" ON public.delivery_zones;
CREATE POLICY "Admin only read delivery zones" ON public.delivery_zones FOR SELECT USING (is_admin());

-- 4. Fix function search paths (critical security issue)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- 5. Create secure email queue processing function
CREATE OR REPLACE FUNCTION public.process_stuck_emails()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  processed_count integer := 0;
  failed_count integer := 0;
BEGIN
  -- Update stuck emails to failed status for manual review
  UPDATE communication_events 
  SET 
    status = 'failed',
    updated_at = now(),
    template_variables = template_variables || jsonb_build_object(
      'stuck_recovery', true,
      'recovered_at', now(),
      'original_status', 'queued'
    )
  WHERE status = 'queued' 
    AND created_at < now() - interval '30 minutes'
    AND (template_key IS NULL OR template_key = '');
  
  GET DIAGNOSTICS failed_count = ROW_COUNT;
  
  -- Reset valid emails to queued status
  UPDATE communication_events 
  SET 
    status = 'queued',
    updated_at = now(),
    template_variables = template_variables || jsonb_build_object(
      'reset_recovery', true,
      'reset_at', now()
    )
  WHERE status = 'queued' 
    AND created_at < now() - interval '30 minutes'
    AND template_key IS NOT NULL 
    AND template_key != '';
  
  GET DIAGNOSTICS processed_count = ROW_COUNT;
  
  -- Log the recovery action
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'stuck_email_recovery',
    'Email System Recovery',
    'Processed stuck emails during security fix',
    jsonb_build_object(
      'processed_count', processed_count,
      'failed_count', failed_count,
      'recovery_timestamp', now()
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'processed_count', processed_count,
    'failed_count', failed_count
  );
END;
$$;

-- 6. Execute the stuck email recovery
SELECT public.process_stuck_emails();