
-- Recreate business_settings table with comprehensive branding and SEO fields
CREATE TABLE public.business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tagline TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  website_url TEXT,
  logo_url TEXT,
  
  -- Social media links
  facebook_url TEXT,
  instagram_url TEXT,
  tiktok_url TEXT,
  twitter_url TEXT,
  linkedin_url TEXT,
  youtube_url TEXT,
  
  -- SEO settings
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create storage bucket for business logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-logos', 'business-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for business logos
CREATE POLICY "Public read access for business logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'business-logos');

CREATE POLICY "Admins can upload business logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'business-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can update business logos"
ON storage.objects FOR UPDATE  
USING (bucket_id = 'business-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can delete business logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'business-logos' AND auth.role() = 'authenticated');

-- Add updated_at trigger
CREATE TRIGGER handle_updated_at_business_settings
BEFORE UPDATE ON public.business_settings
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- Enable RLS on business_settings
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for business_settings
CREATE POLICY "Admins can manage business settings"
ON public.business_settings FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Public can view business settings"
ON public.business_settings FOR SELECT
USING (true);

-- Insert default business settings if none exist
INSERT INTO public.business_settings (
  name, 
  seo_title, 
  seo_description
) 
SELECT 
  'DotCrafts',
  'DotCrafts - Your Business Management Solution',
  'Streamline your business operations with DotCrafts comprehensive management platform.'
WHERE NOT EXISTS (SELECT 1 FROM public.business_settings);
