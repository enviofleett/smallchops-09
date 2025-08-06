-- Fix RLS policies to allow proper data access for authenticated users

-- Enable RLS on main tables if not already enabled
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies that might be blocking data access
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.products;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.categories;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.customer_accounts;

-- Create permissive policies for authenticated users to access all data
CREATE POLICY "Allow authenticated users full access to products" 
ON public.products FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to categories" 
ON public.categories FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to orders" 
ON public.orders FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to customer accounts" 
ON public.customer_accounts FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Also ensure the customers table has proper policies
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.customers;

CREATE POLICY "Allow authenticated users full access to customers" 
ON public.customers FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Ensure order_items table has proper access
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.order_items;

CREATE POLICY "Allow authenticated users full access to order items" 
ON public.order_items FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Log the policy update
INSERT INTO public.audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'rls_policies_updated',
  'Database Security',
  'Updated RLS policies to allow authenticated users full access to dashboard data',
  jsonb_build_object(
    'tables_updated', ARRAY['products', 'categories', 'orders', 'customer_accounts', 'customers', 'order_items'],
    'policy_type', 'authenticated_full_access',
    'updated_at', NOW()
  )
);