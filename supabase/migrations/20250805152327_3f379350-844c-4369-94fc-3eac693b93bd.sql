-- Fix customer favorites RLS policy to properly link customer_accounts
DROP POLICY IF EXISTS "Customers can manage their own favorites" ON customer_favorites;
DROP POLICY IF EXISTS "Allow insert for own favorites" ON customer_favorites;

-- Create proper RLS policies for customer_favorites
CREATE POLICY "Customers can manage their own favorites" 
ON customer_favorites 
FOR ALL 
USING (customer_id IN (
  SELECT id FROM customer_accounts WHERE user_id = auth.uid()
))
WITH CHECK (customer_id IN (
  SELECT id FROM customer_accounts WHERE user_id = auth.uid()
));

-- Also fix orders to properly link with customer_accounts by email when customer_id is null
-- Add a function to update orders customer_id when customers sign up
CREATE OR REPLACE FUNCTION link_guest_orders_to_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When a new customer account is created, link existing guest orders by email
  IF NEW.email IS NOT NULL THEN
    UPDATE orders 
    SET customer_id = NEW.id, updated_at = NOW()
    WHERE customer_email = NEW.email 
      AND customer_id IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically link guest orders when customer signs up
DROP TRIGGER IF EXISTS trigger_link_guest_orders ON customer_accounts;
CREATE TRIGGER trigger_link_guest_orders
  AFTER INSERT ON customer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION link_guest_orders_to_customer();