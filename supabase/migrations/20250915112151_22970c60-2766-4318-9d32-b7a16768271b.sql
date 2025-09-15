-- Ensure products-images bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('products-images', 'products-images', true, 20971520) -- 20MB limit
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 20971520;

-- Create comprehensive storage policies for products-images
-- Allow public read access to all product images
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'products-images');

-- Allow authenticated users to upload product images
CREATE POLICY "Authenticated Upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'products-images' 
    AND auth.uid() IS NOT NULL
  );

-- Allow users to update their own uploaded images
CREATE POLICY "Authenticated Update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'products-images' 
    AND auth.uid() IS NOT NULL
  );

-- Allow users to delete product images
CREATE POLICY "Authenticated Delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'products-images' 
    AND auth.uid() IS NOT NULL
  );