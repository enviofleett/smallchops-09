-- Fix customer profile loading by cleaning up conflicting RLS policies and creating a simple, reliable policy

-- First, drop the conflicting policies on customer_accounts
DROP POLICY IF EXISTS "Allow authenticated users full access to customer accounts" ON customer_accounts;
DROP POLICY IF EXISTS "Customers can insert their own account" ON customer_accounts;
DROP POLICY IF EXISTS "Customers can update their own account" ON customer_accounts;
DROP POLICY IF EXISTS "Customers can view and update their own account" ON customer_accounts;
DROP POLICY IF EXISTS "Customers can view their own account" ON customer_accounts;
DROP POLICY IF EXISTS "users_can_view_own_customer_account" ON customer_accounts;

-- Drop conflicting policies on orders
DROP POLICY IF EXISTS "users_can_view_own_orders" ON orders;
DROP POLICY IF EXISTS "users_can_insert_own_orders" ON orders;

-- Create a simple, reliable function to get current user email
CREATE OR REPLACE FUNCTION current_user_email()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'email',
    (SELECT email FROM auth.users WHERE id = auth.uid())
  );
$$;

-- Create clean, simple RLS policies for customer_accounts
CREATE POLICY "customers_full_access" ON customer_accounts
  FOR ALL 
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR lower(email) = lower(current_user_email())
  )
  WITH CHECK (
    user_id = auth.uid() 
    OR lower(email) = lower(current_user_email())
  );

-- Create clean, simple RLS policies for orders  
CREATE POLICY "customers_view_orders" ON orders
  FOR SELECT 
  TO authenticated
  USING (
    lower(customer_email) = lower(current_user_email())
    OR customer_id IN (
      SELECT id FROM customer_accounts 
      WHERE user_id = auth.uid()
    )
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON customer_accounts TO authenticated;
GRANT SELECT ON orders TO authenticated;