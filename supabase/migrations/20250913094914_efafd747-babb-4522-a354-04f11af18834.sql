-- CRITICAL SECURITY FIX: Remove public access to business_settings table
-- This table contains sensitive business configuration data that should only be accessible to admins

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Admin can update business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Admin can view business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Admins can manage business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Admins only can access business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Secure admins manage business settings" ON public.business_settings;

-- Ensure RLS is enabled
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Create single, strict policy for admin-only access
CREATE POLICY "business_settings_admin_only_access" 
ON public.business_settings 
FOR ALL 
USING (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = 'admin'::user_role 
      AND is_active = true
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = 'admin'::user_role 
      AND is_active = true
  )
);

-- Log this critical security fix
INSERT INTO public.audit_logs (
  action,
  category,
  message,
  user_id,
  new_values
) VALUES (
  'critical_security_fix_applied',
  'Security',
  'CRITICAL: Removed public access to business_settings table - contained sensitive business data',
  auth.uid(),
  jsonb_build_object(
    'vulnerability_type', 'public_business_configuration_access',
    'severity', 'critical', 
    'data_exposed', 'admin_emails, vat_rates, delivery_config, business_hours',
    'fix_applied_at', NOW()
  )
);