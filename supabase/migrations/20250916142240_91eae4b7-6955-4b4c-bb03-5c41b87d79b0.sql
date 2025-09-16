-- CRITICAL SECURITY FIX: Drop and recreate all RLS policies for sensitive data tables
-- This migration addresses critical security vulnerabilities identified in production audit

-- First, create the is_admin function if it doesn't exist
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user has admin role in profiles table
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
EXCEPTION 
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Drop ALL existing policies on business_settings table
DO $$
DECLARE
    policy_name text;
BEGIN
    FOR policy_name IN 
        SELECT policyname FROM pg_policies 
        WHERE tablename = 'business_settings' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.business_settings', policy_name);
    END LOOP;
END
$$;

-- Drop ALL existing policies on business_sensitive_data table  
DO $$
DECLARE
    policy_name text;
BEGIN
    FOR policy_name IN 
        SELECT policyname FROM pg_policies 
        WHERE tablename = 'business_sensitive_data' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.business_sensitive_data', policy_name);
    END LOOP;
END
$$;

-- Drop ALL existing policies on communication_settings table
DO $$
DECLARE
    policy_name text;
BEGIN
    FOR policy_name IN 
        SELECT policyname FROM pg_policies 
        WHERE tablename = 'communication_settings' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.communication_settings', policy_name);
    END LOOP;
END
$$;

-- Create new secure policies for business_settings table
CREATE POLICY "admin_only_read_business_settings" ON public.business_settings
  FOR SELECT USING (is_admin());

CREATE POLICY "admin_only_manage_business_settings" ON public.business_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Create new secure policies for business_sensitive_data table
CREATE POLICY "admin_only_read_business_sensitive_data" ON public.business_sensitive_data
  FOR SELECT USING (is_admin());

CREATE POLICY "admin_only_manage_business_sensitive_data" ON public.business_sensitive_data
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Create new secure policies for communication_settings table
CREATE POLICY "admin_only_read_communication_settings" ON public.communication_settings
  FOR SELECT USING (is_admin());

CREATE POLICY "admin_only_manage_communication_settings" ON public.communication_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Update function security - set proper search_path
CREATE OR REPLACE FUNCTION public.get_public_paystack_config()
RETURNS TABLE(public_key text, test_mode boolean, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN psc.test_mode THEN psc.test_public_key 
      ELSE psc.live_public_key 
    END as public_key,
    psc.test_mode,
    CASE 
      WHEN psc.test_mode THEN (psc.test_public_key IS NOT NULL AND psc.test_secret_key IS NOT NULL)
      ELSE (psc.live_public_key IS NOT NULL AND psc.live_secret_key IS NOT NULL)
    END as is_valid
  FROM public.paystack_secure_config psc
  WHERE psc.is_active = true
  ORDER BY psc.updated_at DESC
  LIMIT 1;
END;
$$;

-- Log this critical security fix
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'critical_security_fix_completed',
  'Security',
  'Successfully applied RLS policies to secure all sensitive business data tables',
  jsonb_build_object(
    'tables_secured', ARRAY['business_settings', 'business_sensitive_data', 'communication_settings'],
    'admin_only_access', true,
    'public_access_removed', true,
    'policies_recreated', true,
    'timestamp', now()
  )
);