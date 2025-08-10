-- Tighten RLS on public.orders: remove permissive policies and add least-privilege policies

-- Ensure RLS is enabled
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on orders to avoid permissive overlaps
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT polname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'orders'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', pol.polname);
  END LOOP;
END$$;

-- Admins can fully manage orders
CREATE POLICY "Admins can manage all orders"
ON public.orders
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Service role (Edge Functions) can fully manage orders
CREATE POLICY "Service roles can manage all orders"
ON public.orders
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Customers can only view their own orders (by linked customer account or email match)
CREATE POLICY "Customers can view their own orders"
ON public.orders
FOR SELECT
USING (
  (
    customer_id IS NOT NULL AND customer_id IN (
      SELECT ca.id
      FROM customer_accounts ca
      WHERE ca.user_id = auth.uid()
    )
  )
  OR
  (
    customer_email IS NOT NULL AND lower(customer_email) = current_user_email()
  )
);
