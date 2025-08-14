-- Complete critical authentication fixes for OrdersSection

-- Drop any remaining conflicting policies that might cause issues
DROP POLICY IF EXISTS "customers_view_orders" ON orders;
DROP POLICY IF EXISTS "Service roles can manage orders" ON orders;
DROP POLICY IF EXISTS "users_can_insert_own_orders" ON orders;

-- Create the most reliable current_user_email function
CREATE OR REPLACE FUNCTION current_user_email()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  -- Method 1: Try JWT email claim
  SELECT COALESCE(
    auth.jwt() ->> 'email',
    (auth.jwt() -> 'user_metadata' ->> 'email')
  ) INTO user_email;
  
  -- Method 2: Fallback to auth.users if JWT fails
  IF user_email IS NULL OR user_email = '' THEN
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = auth.uid()
    LIMIT 1;
  END IF;
  
  RETURN user_email;
END;
$$;

-- Create single, optimized RLS policy for orders
CREATE POLICY "customer_orders_simple_access" ON orders
  FOR SELECT 
  TO authenticated
  USING (
    lower(customer_email) = lower(current_user_email())
    AND current_user_email() IS NOT NULL
  );