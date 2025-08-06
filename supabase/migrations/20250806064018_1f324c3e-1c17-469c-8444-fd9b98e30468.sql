-- Create hero-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-images', 'hero-images', true);

-- Create storage policies for hero images
CREATE POLICY "Public can view hero images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'hero-images');

CREATE POLICY "Admins can upload hero images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'hero-images' AND 
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update hero images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'hero-images' AND 
       EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete hero images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'hero-images' AND 
       EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Create hero_carousel_images table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.hero_carousel_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  alt_text TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on hero_carousel_images
ALTER TABLE public.hero_carousel_images ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for hero_carousel_images
CREATE POLICY "Public can view active hero images"
ON public.hero_carousel_images
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage hero images"
ON public.hero_carousel_images
FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_hero_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_hero_images_updated_at
  BEFORE UPDATE ON public.hero_carousel_images
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hero_images_updated_at();