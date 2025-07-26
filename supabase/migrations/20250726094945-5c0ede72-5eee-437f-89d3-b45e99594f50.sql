-- Fix critical security and data integrity issues for customer_favorites

-- 1. Add missing foreign key constraints for data integrity
ALTER TABLE public.customer_favorites 
ADD CONSTRAINT customer_favorites_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- 2. Fix RLS policies - current policies are too permissive
DROP POLICY IF EXISTS "Customers can view their own favorites" ON public.customer_favorites;
DROP POLICY IF EXISTS "Customers can add their own favorites" ON public.customer_favorites;
DROP POLICY IF EXISTS "Customers can remove their own favorites" ON public.customer_favorites;

-- Create proper RLS policies that require service role for public API access
CREATE POLICY "Service role can manage all favorites" 
ON public.customer_favorites 
FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Staff can view all favorites" 
ON public.customer_favorites 
FOR SELECT 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text]));

-- 3. Add unique constraint to prevent duplicate favorites
ALTER TABLE public.customer_favorites 
ADD CONSTRAINT customer_favorites_customer_product_unique 
UNIQUE (customer_id, product_id);

-- 4. Create index for better performance on customer queries
CREATE INDEX IF NOT EXISTS idx_customer_favorites_customer_id 
ON public.customer_favorites(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_favorites_product_id 
ON public.customer_favorites(product_id);