-- Phase 1: Fix Simplified Order Management Database Schema
-- Drop old policies first if they exist

DROP POLICY IF EXISTS "Admins can manage orders" ON orders_new;
DROP POLICY IF EXISTS "Admins can manage order items" ON order_items_new;
DROP POLICY IF EXISTS "Admins can manage delivery schedule" ON order_delivery_schedule;
DROP POLICY IF EXISTS "Admins can view audit logs" ON order_audit;
DROP POLICY IF EXISTS "System can insert audit logs" ON order_audit;

-- Create policies for admin access (fixed)
CREATE POLICY "Admins can manage orders" ON orders_new
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can manage order items" ON order_items_new
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can manage delivery schedule" ON order_delivery_schedule
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admins can view audit logs" ON order_audit
  FOR SELECT USING (is_admin());

CREATE POLICY "System can insert audit logs" ON order_audit
  FOR INSERT WITH CHECK (true);

-- Enable realtime for the new tables
ALTER PUBLICATION supabase_realtime ADD TABLE orders_new;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items_new;
ALTER PUBLICATION supabase_realtime ADD TABLE order_delivery_schedule;
ALTER PUBLICATION supabase_realtime ADD TABLE order_audit;