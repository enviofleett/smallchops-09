-- Phase 1: Critical Security Fixes
-- Fix RLS policies for sensitive tables to prevent unauthorized access

-- 1. Secure payment_integrations table (admin only access)
ALTER TABLE public.payment_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can manage payment integrations" ON public.payment_integrations;
CREATE POLICY "Only admins can manage payment integrations"
ON public.payment_integrations
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- 2. Secure customer_accounts table (customers see own data only)
ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view their own account" ON public.customer_accounts;
DROP POLICY IF EXISTS "Customers can update their own account" ON public.customer_accounts;
DROP POLICY IF EXISTS "Service roles can manage customer accounts" ON public.customer_accounts;

CREATE POLICY "Customers can view their own account"
ON public.customer_accounts
FOR SELECT
USING (user_id = auth.uid() OR email = current_user_email());

CREATE POLICY "Customers can update their own account" 
ON public.customer_accounts
FOR UPDATE
USING (user_id = auth.uid() OR email = current_user_email())
WITH CHECK (user_id = auth.uid() OR email = current_user_email());

CREATE POLICY "Service roles can manage customer accounts"
ON public.customer_accounts
FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Admins can manage all customer accounts"
ON public.customer_accounts
FOR ALL
USING (is_admin());

-- 3. Secure admin_sessions table (admin access to own sessions only)
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view their own sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "System can manage admin sessions" ON public.admin_sessions;

CREATE POLICY "Admins can view their own sessions"
ON public.admin_sessions
FOR SELECT
USING (user_id = auth.uid() AND is_admin());

CREATE POLICY "System can manage admin sessions"
ON public.admin_sessions
FOR ALL
USING (auth.role() = 'service_role');

-- 4. Secure smtp_provider_configs table (admin only access)
ALTER TABLE public.smtp_provider_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage SMTP providers" ON public.smtp_provider_configs;
DROP POLICY IF EXISTS "Service roles can manage SMTP providers" ON public.smtp_provider_configs;

CREATE POLICY "Admins can manage SMTP providers"
ON public.smtp_provider_configs
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Service roles can manage SMTP providers"
ON public.smtp_provider_configs
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 5. Secure customer_otp_codes table (service roles only)
ALTER TABLE public.customer_otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service roles can manage customer OTP codes" ON public.customer_otp_codes;

CREATE POLICY "Service roles can manage customer OTP codes"
ON public.customer_otp_codes
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Add current_user_email() function if it doesn't exist
CREATE OR REPLACE FUNCTION current_user_email()
RETURNS TEXT
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;