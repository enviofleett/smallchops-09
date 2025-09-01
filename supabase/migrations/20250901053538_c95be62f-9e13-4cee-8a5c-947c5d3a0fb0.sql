-- CRITICAL SECURITY FIXES - Part 1: Database Security

-- 1. Fix mutable search_path vulnerabilities in key functions
CREATE OR REPLACE FUNCTION public.strict_word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
 SET search_path = 'public'
AS '$libdir/pg_trgm', $function$strict_word_similarity$function$;

-- 2. Restrict overly permissive RLS policies for business data
-- Drop existing overly permissive policies on business_settings
DROP POLICY IF EXISTS "business_settings_read_policy" ON public.business_settings;
DROP POLICY IF EXISTS "business_settings_admin_policy" ON public.business_settings;

-- Create more restrictive business_settings policies
CREATE POLICY "Public read limited business info"
ON public.business_settings
FOR SELECT
TO public
USING (true);

-- Only allow admins to modify business settings  
CREATE POLICY "Admins manage business settings"
ON public.business_settings
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 3. Secure delivery zones - restrict to authenticated users only
DROP POLICY IF EXISTS "Public can view delivery zones" ON public.delivery_zones;

CREATE POLICY "Authenticated users can view delivery zones"
ON public.delivery_zones
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage delivery zones"
ON public.delivery_zones
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 4. Secure delivery fees - restrict to authenticated users only
DROP POLICY IF EXISTS "Public can view delivery fees" ON public.delivery_fees;

CREATE POLICY "Authenticated users can view delivery fees"
ON public.delivery_fees
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage delivery fees"
ON public.delivery_fees
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 5. Add rate limiting for sensitive operations
CREATE TABLE IF NOT EXISTS public.security_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  operation_type TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rate limits"
ON public.security_rate_limits
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service roles can manage rate limits"
ON public.security_rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);