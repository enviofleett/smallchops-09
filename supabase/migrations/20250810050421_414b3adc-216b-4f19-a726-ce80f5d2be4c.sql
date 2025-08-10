
-- 1) Ensure RLS is enabled (safe even if already enabled)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

-- 2) Admins can view paid orders for analytics
--    Restricting to paid orders helps privacy and aligns with how the reports function filters.
CREATE POLICY "Admins can view paid orders for analytics"
  ON public.orders
  FOR SELECT
  USING (is_admin() AND payment_status = 'paid');

-- 3) Public can read products (keeps storefront and analytics safe to run)
CREATE POLICY "Public read products"
  ON public.products
  FOR SELECT
  USING (true);

-- 4) Admins can view customer accounts for dashboard analytics
CREATE POLICY "Admins can view customer accounts (dashboard)"
  ON public.customer_accounts
  FOR SELECT
  USING (is_admin());
