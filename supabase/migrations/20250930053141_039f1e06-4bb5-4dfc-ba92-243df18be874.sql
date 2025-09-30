-- Fix customer orders RLS policies for production
-- Remove problematic policies and add reliable ones

-- ========================================
-- ORDERS TABLE - Customer Access Fix
-- ========================================

-- Drop all redundant/problematic customer policies
DROP POLICY IF EXISTS "customer_orders_simple_access" ON orders;
DROP POLICY IF EXISTS "customer_view_own_orders" ON orders;
DROP POLICY IF EXISTS "orders_customer_select" ON orders;
DROP POLICY IF EXISTS "orders_production_customer_own" ON orders;

-- Create single, reliable customer read policy using auth.email()
CREATE POLICY "customers_can_view_own_orders_by_email"
ON orders
FOR SELECT
TO public
USING (
  auth.uid() IS NOT NULL 
  AND (
    customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR customer_id = auth.uid()
  )
);

-- ========================================
-- ORDER_ITEMS TABLE - Customer Access Fix
-- ========================================

-- Drop problematic order_items policies
DROP POLICY IF EXISTS "users_can_view_own_order_items" ON order_items;

-- Create single, reliable policy for customers to view their order items
CREATE POLICY "customers_can_view_own_order_items"
ON order_items
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
    AND auth.uid() IS NOT NULL
    AND (
      o.customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      OR o.customer_id = auth.uid()
    )
  )
);

-- ========================================
-- CUSTOMER_ACCOUNTS TABLE - Ensure customers can read their own account
-- ========================================

-- Drop existing customer access policy if it exists
DROP POLICY IF EXISTS "customers_can_view_own_account" ON customer_accounts;

-- Create policy for customers to view their own account
CREATE POLICY "customers_can_view_own_account"
ON customer_accounts
FOR SELECT
TO public
USING (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
);

-- ========================================
-- ORDER_DELIVERY_SCHEDULE TABLE - Customer read access
-- ========================================

-- Ensure customers can view delivery schedules for their orders
DROP POLICY IF EXISTS "customers_can_view_own_delivery_schedules" ON order_delivery_schedule;

CREATE POLICY "customers_can_view_own_delivery_schedules"
ON order_delivery_schedule
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_delivery_schedule.order_id
    AND auth.uid() IS NOT NULL
    AND (
      o.customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      OR o.customer_id = auth.uid()
    )
  )
);

-- ========================================
-- Add index for better query performance
-- ========================================

-- Index on orders.customer_email for faster customer order lookups
CREATE INDEX IF NOT EXISTS idx_orders_customer_email_auth 
ON orders(customer_email) 
WHERE customer_email IS NOT NULL;

-- Index on orders.customer_id for faster lookup
CREATE INDEX IF NOT EXISTS idx_orders_customer_id_auth 
ON orders(customer_id) 
WHERE customer_id IS NOT NULL;

-- Composite index for order items with orders
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_product 
ON order_items(order_id, product_id);

COMMENT ON POLICY "customers_can_view_own_orders_by_email" ON orders IS 
'Allows authenticated customers to view their own orders using email or customer_id match';

COMMENT ON POLICY "customers_can_view_own_order_items" ON order_items IS 
'Allows customers to view order items for orders they own';

COMMENT ON POLICY "customers_can_view_own_delivery_schedules" ON order_delivery_schedule IS 
'Allows customers to view delivery schedules for their orders';