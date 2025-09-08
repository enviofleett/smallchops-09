-- Fix SECURITY DEFINER function search path vulnerability
ALTER FUNCTION public.trigger_order_status_email_notifications() SET search_path = 'public';

-- Create safe public view for business settings (removing admin metadata exposure)
CREATE OR REPLACE VIEW public.business_info AS
SELECT 
  id,
  name,
  tagline,
  logo_url,
  logo_alt_text,
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
  social_card_url,
  working_hours,
  business_hours,
  delivery_scheduling_config,
  allow_guest_checkout,
  default_vat_rate,
  site_url,
  created_at,
  updated_at
FROM business_settings;

-- Enable RLS on business_settings and restrict to admins only
DROP POLICY IF EXISTS "Public can view business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Secure public read business info" ON public.business_settings;

CREATE POLICY "Admins only can access business settings"
ON public.business_settings
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Allow public read access to the safe view
GRANT SELECT ON public.business_info TO anon, authenticated;

-- Enable RLS on menu_structure and restrict to admins
ALTER TABLE public.menu_structure ENABLE ROW LEVEL SECURITY;

-- Drop existing policy first, then create new one
DROP POLICY IF EXISTS "Admins can manage menu structure" ON public.menu_structure;

CREATE POLICY "Admins can manage menu structure"
ON public.menu_structure
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Add audit logging for high-privilege actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_type,
    entity_id,
    new_values,
    event_time
  ) VALUES (
    p_action,
    'Security',
    format('Admin action: %s on %s', p_action, COALESCE(p_entity_type, 'system')),
    auth.uid(),
    p_entity_type,
    p_entity_id,
    p_details,
    NOW()
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;