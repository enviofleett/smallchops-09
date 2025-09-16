-- CRITICAL SECURITY FIX: Implement RLS policies for sensitive data tables
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

-- Secure business_settings table - CRITICAL: Contains admin emails, payment settings
DROP POLICY IF EXISTS "Public can read business settings" ON public.business_settings;
CREATE POLICY "Only admins can read business settings" ON public.business_settings
  FOR SELECT USING (is_admin());

CREATE POLICY "Only admins can manage business settings" ON public.business_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Secure business_sensitive_data table - CRITICAL: Contains API keys, financial info
DROP POLICY IF EXISTS "Public can read business sensitive data" ON public.business_sensitive_data;
CREATE POLICY "Only admins can read business sensitive data" ON public.business_sensitive_data
  FOR SELECT USING (is_admin());

CREATE POLICY "Only admins can manage business sensitive data" ON public.business_sensitive_data
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Secure communication_settings table - CRITICAL: Contains SMTP credentials
DROP POLICY IF EXISTS "Public can read communication settings" ON public.communication_settings;
CREATE POLICY "Only admins can read communication settings" ON public.communication_settings
  FOR SELECT USING (is_admin());

CREATE POLICY "Only admins can manage communication settings" ON public.communication_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Check if environment_config table exists and secure it
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'environment_config') THEN
    -- Secure environment_config table - CRITICAL: Contains payment gateway config
    DROP POLICY IF EXISTS "Public can read environment config" ON public.environment_config;
    EXECUTE 'CREATE POLICY "Only admins can read environment config" ON public.environment_config FOR SELECT USING (is_admin())';
    EXECUTE 'CREATE POLICY "Only admins can manage environment config" ON public.environment_config FOR ALL USING (is_admin()) WITH CHECK (is_admin())';
  END IF;
END
$$;

-- Fix function security issues - set proper search_path for all functions
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

-- Create secure public endpoint for business info (non-sensitive data only)
CREATE OR REPLACE FUNCTION public.get_public_business_info()
RETURNS TABLE(
  name text,
  tagline text,
  logo_url text,
  primary_color text,
  secondary_color text,
  accent_color text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bs.name,
    bs.tagline,
    bs.logo_url,
    bs.primary_color,
    bs.secondary_color,
    bs.accent_color
  FROM public.business_settings bs
  LIMIT 1;
END;
$$;

-- Log this critical security fix
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'critical_security_fix_applied',
  'Security',
  'Applied RLS policies to secure sensitive business data tables',
  jsonb_build_object(
    'tables_secured', ARRAY['business_settings', 'business_sensitive_data', 'communication_settings'],
    'admin_only_access', true,
    'public_access_removed', true,
    'timestamp', now()
  )
);