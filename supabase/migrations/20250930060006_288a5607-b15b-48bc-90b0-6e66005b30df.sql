-- ====================================================================
-- CRITICAL FIX: Remove RLS policies that access auth.users table
-- Replace with safe policies using auth.uid() and auth.email()
-- ====================================================================

-- Phase 1: Drop problematic policies that directly query auth.users
-- ====================================================================

-- Drop problematic orders policies
DROP POLICY IF EXISTS "customers_can_view_own_orders_by_email" ON orders;

-- Drop problematic order_items policies
DROP POLICY IF EXISTS "Customers can create order items during checkout" ON order_items;
DROP POLICY IF EXISTS "customers_can_view_own_order_items" ON order_items;

-- Drop problematic customer_accounts policies
DROP POLICY IF EXISTS "customers_full_access" ON customer_accounts;

-- Drop problematic order_delivery_schedule policies
DROP POLICY IF EXISTS "customers_can_view_own_delivery_schedules" ON order_delivery_schedule;

-- Phase 2: Create safe RLS policies using auth.uid() and auth.email()
-- ====================================================================

-- ORDERS table: Safe policies for customers
-- ====================================================================
CREATE POLICY "customers_can_create_own_orders" ON orders
FOR INSERT TO authenticated
WITH CHECK (
  (customer_id = auth.uid()) 
  OR (customer_email = auth.email())
);

-- ORDER_ITEMS table: Safe policies using EXISTS with orders table
-- ====================================================================
CREATE POLICY "customers_view_own_order_items_safe" ON order_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
    AND (
      o.customer_id = auth.uid()
      OR o.customer_email = auth.email()
    )
  )
);

CREATE POLICY "customers_insert_order_items_safe" ON order_items
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
    AND (
      o.customer_id = auth.uid()
      OR o.customer_email = auth.email()
    )
  )
);

-- CUSTOMER_ACCOUNTS table: Simple and safe policy
-- ====================================================================
CREATE POLICY "customers_manage_own_account_safe" ON customer_accounts
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ORDER_DELIVERY_SCHEDULE table: Safe policy using EXISTS
-- ====================================================================
CREATE POLICY "customers_view_own_delivery_schedule_safe" ON order_delivery_schedule
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_delivery_schedule.order_id
    AND (
      o.customer_id = auth.uid()
      OR o.customer_email = auth.email()
    )
  )
);

-- Phase 3: Add performance indexes for efficient policy checks
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_delivery_schedule_order_id ON order_delivery_schedule(order_id);

-- Add audit log entry
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'rls_policies_fixed_production',
  'Security',
  'Fixed RLS policies to eliminate auth.users table access errors',
  jsonb_build_object(
    'tables_fixed', jsonb_build_array('orders', 'order_items', 'customer_accounts', 'order_delivery_schedule'),
    'method', 'auth.uid() and auth.email() only',
    'performance_indexes_added', true
  )
);