-- Create hero-images storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hero-images', 'hero-images', true);

-- Create products-images storage bucket if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products-images', 'products-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for hero-images bucket
CREATE POLICY "Hero images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'hero-images');

CREATE POLICY "Admins can upload hero images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'hero-images' AND is_admin());

CREATE POLICY "Admins can update hero images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'hero-images' AND is_admin());

CREATE POLICY "Admins can delete hero images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'hero-images' AND is_admin());

-- Create RLS policies for products-images bucket
CREATE POLICY "Product images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'products-images');

CREATE POLICY "Admins can upload product images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'products-images' AND is_admin());

CREATE POLICY "Admins can update product images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'products-images' AND is_admin());

CREATE POLICY "Admins can delete product images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'products-images' AND is_admin());