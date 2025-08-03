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

-- Create sample orders for testing (only if none exist)
INSERT INTO public.orders (
  order_number, customer_name, customer_email, customer_phone,
  order_type, total_amount, status, payment_status,
  delivery_address, delivery_zone_id, order_time, created_at, updated_at
)
SELECT 
  'ORD-' || LPAD((row_number() OVER())::text, 6, '0') as order_number,
  CASE (row_number() OVER()) % 5
    WHEN 1 THEN 'John Doe'
    WHEN 2 THEN 'Jane Smith' 
    WHEN 3 THEN 'Mike Johnson'
    WHEN 4 THEN 'Sarah Wilson'
    ELSE 'David Brown'
  END as customer_name,
  CASE (row_number() OVER()) % 5
    WHEN 1 THEN 'john@example.com'
    WHEN 2 THEN 'jane@example.com'
    WHEN 3 THEN 'mike@example.com'
    WHEN 4 THEN 'sarah@example.com'
    ELSE 'david@example.com'
  END as customer_email,
  CASE (row_number() OVER()) % 5
    WHEN 1 THEN '+234-801-234-5678'
    WHEN 2 THEN '+234-802-345-6789'
    WHEN 3 THEN '+234-803-456-7890'
    WHEN 4 THEN '+234-804-567-8901'
    ELSE '+234-805-678-9012'
  END as customer_phone,
  CASE (row_number() OVER()) % 2
    WHEN 0 THEN 'delivery'::order_type
    ELSE 'pickup'::order_type
  END as order_type,
  (RANDOM() * 50000 + 5000)::numeric(10,2) as total_amount,
  CASE (row_number() OVER()) % 6
    WHEN 1 THEN 'pending'::order_status
    WHEN 2 THEN 'confirmed'::order_status
    WHEN 3 THEN 'preparing'::order_status
    WHEN 4 THEN 'ready'::order_status
    WHEN 5 THEN 'out_for_delivery'::order_status
    ELSE 'delivered'::order_status
  END as status,
  CASE (row_number() OVER()) % 3
    WHEN 1 THEN 'pending'::payment_status
    WHEN 2 THEN 'paid'::payment_status
    ELSE 'failed'::payment_status
  END as payment_status,
  CASE (row_number() OVER()) % 3
    WHEN 1 THEN '123 Lagos Street, Lagos Island, Lagos State'
    WHEN 2 THEN '456 Abuja Road, Garki, FCT'
    ELSE '789 Port Harcourt Avenue, GRA, Rivers State'
  END as delivery_address,
  NULL as delivery_zone_id,
  NOW() - (RANDOM() * INTERVAL '30 days') as order_time,
  NOW() - (RANDOM() * INTERVAL '30 days') as created_at,
  NOW() as updated_at
FROM generate_series(1, 15) 
WHERE NOT EXISTS (SELECT 1 FROM public.orders LIMIT 1);

-- Create sample order items for the orders
INSERT INTO public.order_items (
  order_id, product_id, quantity, unit_price, total_price, 
  product_name, product_image_url, created_at, updated_at
)
SELECT 
  o.id as order_id,
  gen_random_uuid() as product_id,
  (RANDOM() * 3 + 1)::integer as quantity,
  (RANDOM() * 5000 + 1000)::numeric(10,2) as unit_price,
  ((RANDOM() * 3 + 1) * (RANDOM() * 5000 + 1000))::numeric(10,2) as total_price,
  CASE (row_number() OVER()) % 8
    WHEN 1 THEN 'Jollof Rice with Chicken'
    WHEN 2 THEN 'Fried Rice with Beef'
    WHEN 3 THEN 'Pepper Soup'
    WHEN 4 THEN 'Suya Combo'
    WHEN 5 THEN 'Plantain and Beans'
    WHEN 6 THEN 'Egusi Soup with Pounded Yam'
    WHEN 7 THEN 'Chicken Shawarma'
    ELSE 'Meat Pie'
  END as product_name,
  'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300' as product_image_url,
  NOW() as created_at,
  NOW() as updated_at
FROM public.orders o
CROSS JOIN generate_series(1, 2)
WHERE NOT EXISTS (SELECT 1 FROM public.order_items LIMIT 1);

-- Add indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_order_time ON public.orders(order_time DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);