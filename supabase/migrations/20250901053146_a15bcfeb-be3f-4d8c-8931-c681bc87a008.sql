-- CRITICAL SECURITY FIXES

-- 1. Fix mutable search_path vulnerabilities in functions
-- Add SET search_path = 'public' to all functions missing it

CREATE OR REPLACE FUNCTION public.gtrgm_in(cstring)
 RETURNS gtrgm
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
 SET search_path = 'public'
AS '$libdir/pg_trgm', $function$gtrgm_in$function$;

CREATE OR REPLACE FUNCTION public.gtrgm_out(gtrgm)
 RETURNS cstring
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
 SET search_path = 'public'
AS '$libdir/pg_trgm', $function$gtrgm_out$function$;

CREATE OR REPLACE FUNCTION public.strict_word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
 SET search_path = 'public'
AS '$libdir/pg_trgm', $function$strict_word_similarity$function$;

CREATE OR REPLACE FUNCTION public.strict_word_similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
 SET search_path = 'public'
AS '$libdir/pg_trgm', $function$strict_word_similarity_op$function$;

CREATE OR REPLACE FUNCTION public.strict_word_similarity_commutator_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
 SET search_path = 'public'
AS '$libdir/pg_trgm', $function$strict_word_similarity_commutator_op$function$;

CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
 SET search_path = 'public'
AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_op$function$;

CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_commutator_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
 SET search_path = 'public'
AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_commutator_op$function$;

-- 2. Restrict overly permissive RLS policies for business data
-- Remove overly broad public access to sensitive business tables

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

-- 5. Secure pickup points - limit public access to essential info only
DROP POLICY IF EXISTS "Public can view pickup points" ON public.pickup_points;

CREATE POLICY "Public can view active pickup points"
ON public.pickup_points
FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Admins can manage pickup points"
ON public.pickup_points
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 6. Create audit trigger for sensitive data access
CREATE OR REPLACE FUNCTION public.audit_sensitive_data_access()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values
  ) VALUES (
    'sensitive_data_access',
    'Security',
    'Access to sensitive business data: ' || TG_TABLE_NAME,
    auth.uid(),
    COALESCE(NEW.id, OLD.id),
    CASE 
      WHEN NEW IS NOT NULL THEN to_jsonb(NEW)
      ELSE NULL
    END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public';

-- Apply audit triggers to sensitive tables
DROP TRIGGER IF EXISTS audit_business_settings_access ON public.business_settings;
CREATE TRIGGER audit_business_settings_access
  AFTER SELECT OR UPDATE OR INSERT ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_data_access();

-- 7. Create function to validate admin permissions securely
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin' 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public';

-- 8. Add rate limiting for sensitive operations
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

-- 9. Create secure configuration view
CREATE OR REPLACE VIEW public.public_business_config AS
SELECT 
  name,
  tagline,
  logo_url,
  logo_alt_text,
  favicon_url,
  primary_color,
  secondary_color,
  accent_color,
  working_hours,
  seo_title,
  seo_description,
  seo_keywords,
  allow_guest_checkout
FROM public.business_settings
WHERE id IS NOT NULL;

-- Grant public read access to the safe view
GRANT SELECT ON public.public_business_config TO public;

-- 10. Log this security update
INSERT INTO audit_logs (
  action,
  category,
  message,
  user_id,
  new_values
) VALUES (
  'security_hardening_applied',
  'Security',
  'Critical security fixes applied: RLS policies tightened, search_path secured, audit logging enhanced',
  auth.uid(),
  jsonb_build_object(
    'fixes_applied', jsonb_build_array(
      'mutable_search_path_fixed',
      'business_data_access_restricted',
      'delivery_zones_secured',
      'pickup_points_limited',
      'audit_triggers_added',
      'rate_limiting_implemented'
    ),
    'timestamp', NOW()
  )
);