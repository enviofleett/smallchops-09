-- RLS policies to align admin backend with frontend customer access

-- PRODUCTS: Admin full access, Public can view active items
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND policyname='Admins can manage products'
  ) THEN
    CREATE POLICY "Admins can manage products" ON public.products
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND policyname='Public can view active products'
  ) THEN
    CREATE POLICY "Public can view active products" ON public.products
    FOR SELECT
    TO public
    USING (
      status = 'active'::product_status AND COALESCE(stock_quantity,0) > 0 AND COALESCE(price,0) > 0
    );
  END IF;
END $$;

-- ORDERS: Admin full access, Customers can view their own orders
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='Admins can manage orders'
  ) THEN
    CREATE POLICY "Admins can manage orders" ON public.orders
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='Customers can view their own orders'
  ) THEN
    CREATE POLICY "Customers can view their own orders" ON public.orders
    FOR SELECT
    TO authenticated
    USING (
      customer_id IN (
        SELECT ca.id FROM public.customer_accounts ca WHERE ca.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ORDER ITEMS: Admin full access, Customers can view items for their own orders
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_items' AND policyname='Admins can manage order items'
  ) THEN
    CREATE POLICY "Admins can manage order items" ON public.order_items
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_items' AND policyname='Customers can view their own order items'
  ) THEN
    CREATE POLICY "Customers can view their own order items" ON public.order_items
    FOR SELECT
    TO authenticated
    USING (
      order_id IN (
        SELECT o.id FROM public.orders o
        JOIN public.customer_accounts ca ON ca.id = o.customer_id
        WHERE ca.user_id = auth.uid()
      )
    );
  END IF;
END $$;