
-- 1. Create the missing product-images storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure public read access for product images (duplicate policy drop is safe)
DROP POLICY IF EXISTS "Public read access for product images" ON storage.objects;
CREATE POLICY "Public read access for product images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product-images' );

-- 3. Allow anyone to upload/update/delete images (important for frontend/admin tools)
DROP POLICY IF EXISTS "Anyone can upload product images" ON storage.objects;
CREATE POLICY "Anyone can upload product images"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'product-images' );

DROP POLICY IF EXISTS "Anyone can update product images" ON storage.objects;
CREATE POLICY "Anyone can update product images"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'product-images' );

DROP POLICY IF EXISTS "Anyone can delete product images" ON storage.objects;
CREATE POLICY "Anyone can delete product images"
ON storage.objects FOR DELETE
USING ( bucket_id = 'product-images' );

-- 4. (Optional, but recommended for web store) Make public read access to products and categories for everyone
-- This enables anyone (unauthenticated web store user) to view products and categories

-- Public SELECT on products
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
CREATE POLICY "Public can view active products"
ON public.products FOR SELECT
USING ( status = 'active' );

-- Public SELECT on categories
DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
CREATE POLICY "Public can view categories"
ON public.categories FOR SELECT
USING ( true );
