-- CRITICAL SECURITY FIX: Secure environment_config table and migrate to secrets

-- First, drop existing function to allow type change
DROP FUNCTION IF EXISTS public.get_environment_config();

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Admin only environment config" ON public.environment_config;
DROP POLICY IF EXISTS "Admins can manage environment config" ON public.environment_config;  
DROP POLICY IF EXISTS "Only admins can access environment config" ON public.environment_config;

-- Create a single, strict admin-only policy that uses direct table reference (not function)
CREATE POLICY "admin_only_environment_config" 
ON public.environment_config 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = 'admin'::user_role 
      AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = 'admin'::user_role 
      AND is_active = true
  )
);

-- Create a secure function to manage environment configuration
CREATE OR REPLACE FUNCTION public.get_environment_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  config_data jsonb;
  user_is_admin boolean;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = 'admin'::user_role 
      AND is_active = true
  ) INTO user_is_admin;
  
  IF NOT user_is_admin THEN
    RAISE EXCEPTION 'Access denied - admin required';
  END IF;
  
  -- Return non-sensitive config only
  SELECT jsonb_build_object(
    'environment', environment,
    'is_live_mode', is_live_mode,
    'webhook_url', webhook_url,
    'has_live_keys', (paystack_live_public_key IS NOT NULL AND paystack_live_secret_key IS NOT NULL),
    'has_test_keys', (paystack_test_public_key IS NOT NULL AND paystack_test_secret_key IS NOT NULL),
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO config_data
  FROM public.environment_config
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(config_data, '{}'::jsonb);
END;
$$;

-- Add warning about payment keys migration
COMMENT ON TABLE public.environment_config IS 
'WARNING: Payment gateway keys should be migrated to Supabase Edge Function secrets for enhanced security. This table should only contain non-sensitive configuration.';

-- Log this security fix
INSERT INTO public.audit_logs (
  action,
  category,
  message,
  user_id,
  new_values
) VALUES (
  'security_fix_applied',
  'Security',
  'Critical security fix: Secured environment_config table with strict RLS policies',
  auth.uid(),
  jsonb_build_object(
    'fix_type', 'environment_config_security',
    'severity', 'critical',
    'applied_at', NOW()
  )
);