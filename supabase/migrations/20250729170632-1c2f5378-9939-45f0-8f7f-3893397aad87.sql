-- Fix the validate_business_settings function to match current schema
CREATE OR REPLACE FUNCTION public.validate_business_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate required fields
  IF NEW.name IS NULL OR trim(NEW.name) = '' THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;
  
  -- Validate email format if provided
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  
  -- Validate business_hours JSON if provided
  IF NEW.business_hours IS NOT NULL THEN
    BEGIN
      PERFORM NEW.business_hours::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid JSON format for business_hours';
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Now insert the default business settings
INSERT INTO business_settings (
  name, 
  tagline, 
  email, 
  phone, 
  address, 
  logo_url,
  seo_title,
  seo_description,
  facebook_url,
  instagram_url,
  twitter_url
) VALUES (
  'Starters',
  'Premium Small Chops & Catering Services',
  'info@starters.com',
  '+234-XXX-XXX-XXXX',
  'Lagos, Nigeria',
  '/lovable-uploads/4b7e8feb-69d6-41e6-bf51-31bc57291f4a.png',
  'Starters - Premium Small Chops & Catering',
  'Professional small chops and catering services in Lagos. Quality food for all your events and occasions.',
  'https://facebook.com/starters',
  'https://instagram.com/starters',
  'https://twitter.com/starters'
)
ON CONFLICT DO NOTHING;