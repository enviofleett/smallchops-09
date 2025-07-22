
-- Create storage bucket for business logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-logos', 'business-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the business-logos bucket
-- Public read access for logo display
CREATE POLICY "Public read access for business logos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'business-logos' );

-- Admin upload access
CREATE POLICY "Admins can upload business logos"
ON storage.objects FOR INSERT
WITH CHECK ( 
  bucket_id = 'business-logos' 
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Admin update access
CREATE POLICY "Admins can update business logos"
ON storage.objects FOR UPDATE
USING ( 
  bucket_id = 'business-logos' 
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Admin delete access
CREATE POLICY "Admins can delete business logos"
ON storage.objects FOR DELETE
USING ( 
  bucket_id = 'business-logos' 
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);
