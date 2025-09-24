-- Phase 1B: Enable RLS on remaining critical tables and create policies

-- Enable RLS on remaining tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_usage ENABLE ROW LEVEL SECURITY;

-- Create secure RLS policies for customers table (now that RLS is enabled)
CREATE POLICY "Admin and service role access to customers" 
ON customers FOR ALL 
USING (is_admin() OR auth.role() = 'service_role');

-- Create secure RLS policies for payment_transactions table  
CREATE POLICY "Admin only access to payment transactions" 
ON payment_transactions FOR ALL 
USING (is_admin() OR auth.role() = 'service_role');

-- Create secure RLS policies for orders table
CREATE POLICY "Admin and service role access to orders" 
ON orders FOR ALL 
USING (is_admin() OR auth.role() = 'service_role');

-- Create secure RLS policies for customer_accounts table
CREATE POLICY "Admin and service role access to customer accounts" 
ON customer_accounts FOR ALL 
USING (is_admin() OR auth.role() = 'service_role');

-- Fix order_items security - remove public access
DROP POLICY IF EXISTS "Public can view order items" ON order_items;

CREATE POLICY "Admin and service role access to order items" 
ON order_items FOR ALL 
USING (is_admin() OR auth.role() = 'service_role');

-- Secure promotion_usage
CREATE POLICY "Admin and service role access to promotion usage" 
ON promotion_usage FOR ALL 
USING (is_admin() OR auth.role() = 'service_role');