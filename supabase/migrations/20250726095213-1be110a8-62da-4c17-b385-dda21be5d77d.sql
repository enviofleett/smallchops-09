-- Fix critical security issues by recreating all policies properly

-- 1. Drop all existing policies first
DROP POLICY IF EXISTS "Customers can view their own favorites" ON public.customer_favorites;
DROP POLICY IF EXISTS "Customers can add their own favorites" ON public.customer_favorites;
DROP POLICY IF EXISTS "Customers can remove their own favorites" ON public.customer_favorites;
DROP POLICY IF EXISTS "Staff can view all favorites" ON public.customer_favorites;
DROP POLICY IF EXISTS "Service role can manage all favorites" ON public.customer_favorites;

-- 2. Create secure policies that restrict access properly
CREATE POLICY "Service role can manage all favorites" 
ON public.customer_favorites 
FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Staff can view all favorites" 
ON public.customer_favorites 
FOR SELECT 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text]));

-- 3. Add unique constraint to prevent duplicate favorites (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'customer_favorites_customer_product_unique'
    ) THEN
        ALTER TABLE public.customer_favorites 
        ADD CONSTRAINT customer_favorites_customer_product_unique 
        UNIQUE (customer_id, product_id);
    END IF;
END $$;