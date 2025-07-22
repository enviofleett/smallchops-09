
-- Add banner_url column to categories table
ALTER TABLE public.categories 
ADD COLUMN banner_url TEXT;

-- Create storage bucket for category banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-banners', 'category-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the category-banners bucket
DROP POLICY IF EXISTS "Public read access for category banners" ON storage.objects;
CREATE POLICY "Public read access for category banners"
ON storage.objects FOR SELECT
USING ( bucket_id = 'category-banners' );

DROP POLICY IF EXISTS "Authenticated users can upload category banners" ON storage.objects;
CREATE POLICY "Authenticated users can upload category banners"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'category-banners' AND auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Authenticated users can update category banners" ON storage.objects;
CREATE POLICY "Authenticated users can update category banners"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'category-banners' AND auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Authenticated users can delete category banners" ON storage.objects;
CREATE POLICY "Authenticated users can delete category banners"
ON storage.objects FOR DELETE
USING ( bucket_id = 'category-banners' AND auth.role() = 'authenticated' );
