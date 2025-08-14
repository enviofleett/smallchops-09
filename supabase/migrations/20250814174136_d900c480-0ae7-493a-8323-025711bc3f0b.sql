-- Phase 1: Critical Database Migration - Fix Orders RLS Issues
-- 1. Add user_id column to orders table if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Update existing orders to have proper user_id by matching emails with auth.users
UPDATE orders 
SET user_id = (
  SELECT au.id 
  FROM auth.users au 
  WHERE au.email = orders.customer_email
)
WHERE user_id IS NULL AND customer_email IS NOT NULL;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);

-- 4. Drop existing problematic RLS policies
DROP POLICY IF EXISTS "Enable read access for users to own orders" ON orders;
DROP POLICY IF EXISTS "Customers can view their order items (by customer_id or jwt ema" ON order_items;
DROP POLICY IF EXISTS "Customers can view their orders (by customer_id or jwt email)" ON orders;

-- 5. Create simplified, reliable RLS policies for orders
CREATE POLICY "users_can_view_own_orders" ON orders
  FOR SELECT 
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    (customer_email IS NOT NULL AND lower(customer_email) = lower(auth.jwt() ->> 'email'))
  );

CREATE POLICY "users_can_insert_own_orders" ON orders
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR 
    (customer_email IS NOT NULL AND lower(customer_email) = lower(auth.jwt() ->> 'email'))
  );

-- 6. Update order_items RLS policy to match orders
CREATE POLICY "users_can_view_own_order_items" ON order_items
  FOR SELECT 
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders 
      WHERE auth.uid() = user_id OR 
      (customer_email IS NOT NULL AND lower(customer_email) = lower(auth.jwt() ->> 'email'))
    )
  );

-- 7. Ensure customer_accounts has proper RLS policy
DROP POLICY IF EXISTS "Users can view their own customer account" ON customer_accounts;
CREATE POLICY "users_can_view_own_customer_account" ON customer_accounts
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    (email IS NOT NULL AND lower(email) = lower(auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    auth.uid() = user_id OR 
    (email IS NOT NULL AND lower(email) = lower(auth.jwt() ->> 'email'))
  );