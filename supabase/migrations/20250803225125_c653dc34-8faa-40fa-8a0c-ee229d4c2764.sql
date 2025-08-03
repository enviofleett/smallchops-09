-- Clean up overlapping RLS policies for orders table
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can create orders during checkout" ON public.orders;
DROP POLICY IF EXISTS "Public can create orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;

-- Create simplified, non-overlapping RLS policies
CREATE POLICY "Admin users can manage all orders" 
ON public.orders 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Service roles have full access" 
ON public.orders 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Customers can view own orders by email" 
ON public.orders 
FOR SELECT 
USING (
  customer_email IN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
);

CREATE POLICY "Public can create orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (true);

-- Add indexes for better performance (without CONCURRENTLY)
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_time ON public.orders(order_time DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);