-- CRITICAL SECURITY FIXES FOR PRODUCTION READINESS
-- This migration locks down all sensitive data access and implements proper RLS policies

-- 1. SECURE BUSINESS SETTINGS ACCESS
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "business_settings_admin_access" ON public.business_settings;
DROP POLICY IF EXISTS "business_settings_admin_only_access" ON public.business_settings;

-- Create secure admin-only access for business settings
CREATE POLICY "business_settings_admin_only_full_access" 
ON public.business_settings 
FOR ALL 
USING (
  auth.uid() IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'::user_role 
    AND is_active = true
  )
) 
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'::user_role 
    AND is_active = true
  )
);

-- Create safe public view for essential business info only
CREATE OR REPLACE VIEW public.business_info_public AS
SELECT 
  name,
  tagline,
  logo_url,
  logo_dark_url,
  favicon_url,
  primary_color,
  secondary_color,
  accent_color,
  website_url,
  facebook_url,
  instagram_url,
  twitter_url,
  linkedin_url,
  youtube_url,
  tiktok_url,
  seo_title,
  seo_description,
  seo_keywords,
  working_hours,
  business_hours,
  site_url
FROM public.business_settings
WHERE id IS NOT NULL
LIMIT 1;

-- Enable RLS on business_info view (even though it's a view, good practice)
ALTER VIEW public.business_info_public SET (security_barrier = true);

-- Grant public access to the safe view only
GRANT SELECT ON public.business_info_public TO anon;
GRANT SELECT ON public.business_info_public TO authenticated;

-- 2. SECURE PAYMENT INTEGRATION TABLES
-- Lock down environment_config table
DROP POLICY IF EXISTS "environment_config_admin_access" ON public.environment_config;

CREATE POLICY "environment_config_admin_only" 
ON public.environment_config 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

-- Secure payment_transactions table - customers can only see their own
DROP POLICY IF EXISTS "payment_transactions_admin_access" ON public.payment_transactions;
DROP POLICY IF EXISTS "payment_transactions_customer_access" ON public.payment_transactions;

CREATE POLICY "payment_transactions_admin_full_access" 
ON public.payment_transactions 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "payment_transactions_customer_own_access" 
ON public.payment_transactions 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND 
  customer_email IN (
    SELECT email FROM public.customer_accounts 
    WHERE user_id = auth.uid()
  )
);

-- 3. SECURE CUSTOMER DATA ACCESS
-- Update customer_accounts RLS policies for better security
DROP POLICY IF EXISTS "customer can read own account" ON public.customer_accounts;
DROP POLICY IF EXISTS "customer can insert own account" ON public.customer_accounts;

-- Customers can only access their own data
CREATE POLICY "customer_accounts_own_access" 
ON public.customer_accounts 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND 
  (user_id = auth.uid() OR is_admin())
);

CREATE POLICY "customer_accounts_own_insert" 
ON public.customer_accounts 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  user_id = auth.uid()
);

CREATE POLICY "customer_accounts_own_update" 
ON public.customer_accounts 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL AND 
  (user_id = auth.uid() OR is_admin())
) 
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  (user_id = auth.uid() OR is_admin())
);

-- 4. SECURE ORDER ACCESS
-- Customers can only see their own orders
DROP POLICY IF EXISTS "orders_customer_access" ON public.orders;

CREATE POLICY "orders_admin_full_access" 
ON public.orders 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "orders_customer_own_access" 
ON public.orders 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND 
  (
    customer_email IN (
      SELECT email FROM public.customer_accounts 
      WHERE user_id = auth.uid()
    ) OR 
    is_admin()
  )
);

-- 5. SECURE ADMIN INVITATION SYSTEM
-- Add expiration check to admin invitations
CREATE POLICY "admin_invitations_secure_access" 
ON public.admin_invitations 
FOR SELECT 
USING (
  -- Only allow access to non-expired invitations
  expires_at > now() AND 
  status = 'pending' AND
  (is_admin() OR auth.role() = 'service_role')
);

-- Prevent access to expired or used invitations
CREATE POLICY "admin_invitations_secure_update" 
ON public.admin_invitations 
FOR UPDATE 
USING (
  expires_at > now() AND 
  status = 'pending' AND
  (is_admin() OR auth.role() = 'service_role')
) 
WITH CHECK (
  expires_at > now() AND
  (is_admin() OR auth.role() = 'service_role')
);

-- 6. SECURE SENSITIVE BUSINESS DATA
-- Ensure business_sensitive_data is locked down
DROP POLICY IF EXISTS "Admins only access business data" ON public.business_sensitive_data;
DROP POLICY IF EXISTS "Admins can manage sensitive business data" ON public.business_sensitive_data;

CREATE POLICY "business_sensitive_data_admin_only" 
ON public.business_sensitive_data 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

-- 7. SECURE COMMUNICATION SETTINGS
-- Lock down communication settings to admin only
CREATE POLICY "communication_settings_admin_only" 
ON public.communication_settings 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

-- 8. REVOKE DANGEROUS PUBLIC ACCESS
-- Revoke any accidental public grants on sensitive tables
REVOKE ALL ON public.business_settings FROM anon;
REVOKE ALL ON public.business_settings FROM public;
REVOKE ALL ON public.environment_config FROM anon;
REVOKE ALL ON public.environment_config FROM public;
REVOKE ALL ON public.payment_transactions FROM anon;
REVOKE ALL ON public.payment_transactions FROM public;
REVOKE ALL ON public.business_sensitive_data FROM anon;
REVOKE ALL ON public.business_sensitive_data FROM public;
REVOKE ALL ON public.communication_settings FROM anon;
REVOKE ALL ON public.communication_settings FROM public;
REVOKE ALL ON public.admin_invitations FROM anon;
REVOKE ALL ON public.admin_invitations FROM public;

-- 9. CREATE SECURE HELPER FUNCTIONS
-- Function to safely get business info for public use
CREATE OR REPLACE FUNCTION public.get_public_business_info()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'name', name,
    'tagline', tagline,
    'logo_url', logo_url,
    'logo_dark_url', logo_dark_url,
    'primary_color', primary_color,
    'secondary_color', secondary_color,
    'accent_color', accent_color,
    'website_url', website_url,
    'working_hours', working_hours,
    'business_hours', business_hours,
    'social_links', jsonb_build_object(
      'facebook', facebook_url,
      'instagram', instagram_url,
      'twitter', twitter_url,
      'linkedin', linkedin_url,
      'youtube', youtube_url,
      'tiktok', tiktok_url
    ),
    'seo', jsonb_build_object(
      'title', seo_title,
      'description', seo_description,
      'keywords', seo_keywords
    )
  ) INTO result
  FROM public.business_settings
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Grant public access to the safe function
GRANT EXECUTE ON FUNCTION public.get_public_business_info() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_business_info() TO authenticated;

-- 10. AUDIT LOG FOR SECURITY CHANGES
INSERT INTO public.audit_logs (
  action,
  category,
  message,
  user_id,
  new_values
) VALUES (
  'security_hardening_applied',
  'Security',
  'Critical security policies applied for production readiness',
  auth.uid(),
  jsonb_build_object(
    'policies_updated', ARRAY[
      'business_settings',
      'payment_transactions', 
      'customer_accounts',
      'orders',
      'admin_invitations',
      'business_sensitive_data',
      'communication_settings'
    ],
    'security_level', 'production',
    'applied_at', now()
  )
);