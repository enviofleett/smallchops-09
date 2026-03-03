ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS delivery_enabled boolean NOT NULL DEFAULT true;

DROP FUNCTION IF EXISTS public.get_public_business_info();
CREATE OR REPLACE FUNCTION public.get_public_business_info()
 RETURNS TABLE(name text, tagline text, logo_url text, primary_color text, secondary_color text, accent_color text, delivery_enabled boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    bs.name,
    bs.tagline,
    bs.logo_url,
    bs.primary_color,
    bs.secondary_color,
    bs.accent_color,
    COALESCE(bs.delivery_enabled, true)
  FROM public.business_settings bs
  LIMIT 1;
END;
$function$;
