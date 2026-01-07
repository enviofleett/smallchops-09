-- ============================================
-- CRITICAL SECURITY FIX: Protect All Sensitive Data
-- ============================================

-- 1. DRIVERS TABLE: Enable RLS (policies exist but RLS was disabled!)
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Clean up duplicate/redundant driver policies (keep only essential ones)
DROP POLICY IF EXISTS "Drivers can view their own profile" ON public.drivers;
DROP POLICY IF EXISTS "Drivers can view their own record" ON public.drivers;

-- 2. ORDERS TABLE: Remove the dangerous public access policy
DROP POLICY IF EXISTS "Public can view orders by order number for tracking" ON public.orders;

-- Drop any existing version of the function first
DROP FUNCTION IF EXISTS public.get_order_tracking_status(TEXT);

-- Create a secure order tracking function for unauthenticated users
-- This only returns minimal, non-sensitive tracking info
CREATE OR REPLACE FUNCTION public.get_order_tracking_status(p_order_number TEXT)
RETURNS TABLE (
  order_number TEXT,
  status TEXT,
  delivery_status TEXT,
  created_at TIMESTAMPTZ,
  estimated_delivery_date DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.order_number::TEXT,
    o.status::TEXT,
    o.delivery_status::TEXT,
    o.created_at,
    o.delivery_date
  FROM public.orders o
  WHERE o.order_number = p_order_number
  LIMIT 1;
$$;

-- Grant execute to public for order tracking (returns only non-PII data)
GRANT EXECUTE ON FUNCTION public.get_order_tracking_status(TEXT) TO public;
GRANT EXECUTE ON FUNCTION public.get_order_tracking_status(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_tracking_status(TEXT) TO authenticated;

-- Add comment documenting secure nature
COMMENT ON FUNCTION public.get_order_tracking_status IS 'Secure order tracking function - returns ONLY status info, no PII or customer data';

-- 3. Clean up redundant/duplicate order policies (consolidate)
DROP POLICY IF EXISTS "Admin and service role access to orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "admin_orders_full_access" ON public.orders;
DROP POLICY IF EXISTS "orders_production_admin_access" ON public.orders;

-- 4. BUSINESS SETTINGS: Create a secure view for public business settings (no admin emails)
CREATE OR REPLACE VIEW public.public_business_settings AS
SELECT 
  id,
  name,
  tagline,
  logo_url,
  logo_dark_url,
  favicon_url,
  primary_color,
  secondary_color,
  accent_color,
  facebook_url,
  instagram_url,
  twitter_url,
  linkedin_url,
  youtube_url,
  tiktok_url,
  website_url,
  working_hours,
  business_hours,
  allow_guest_checkout,
  delivery_scheduling_config,
  disabled_calendar_dates,
  seo_title,
  seo_description,
  seo_keywords,
  social_card_url,
  whatsapp_support_number
FROM public.business_settings
LIMIT 1;

-- Grant read access to the safe view
GRANT SELECT ON public.public_business_settings TO public;
GRANT SELECT ON public.public_business_settings TO anon;
GRANT SELECT ON public.public_business_settings TO authenticated;

COMMENT ON VIEW public.public_business_settings IS 'Public-safe business settings view - excludes admin emails and sensitive configuration';