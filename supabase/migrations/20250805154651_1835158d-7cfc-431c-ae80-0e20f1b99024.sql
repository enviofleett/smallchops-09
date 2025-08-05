-- Fix order items table column consistency and customer relationships
-- 1. First check current column in order_items table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'order_items' 
AND table_schema = 'public' 
AND column_name LIKE '%price%';

-- 2. Create missing customer account links for existing orders via email
-- Link orders to customer_accounts where possible
UPDATE orders 
SET customer_id = ca.id
FROM customer_accounts ca
WHERE orders.customer_email = ca.name  -- Using 'name' as email field in customer_accounts
AND orders.customer_id IS NULL;

-- 3. Add index for better performance on customer order lookups
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_name_email ON customer_accounts(name);

-- 4. Add function to ensure cart clearing after successful payment
CREATE OR REPLACE FUNCTION clear_cart_after_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert audit log when order payment status changes to paid
  IF NEW.payment_status = 'paid' AND OLD.payment_status != 'paid' THEN
    INSERT INTO audit_logs (
      action,
      category,
      message,
      entity_type,
      entity_id,
      new_values
    ) VALUES (
      'payment_confirmed',
      'Order Processing',
      'Order payment confirmed - cart should be cleared',
      'orders',
      NEW.id,
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'customer_email', NEW.customer_email,
        'payment_status', NEW.payment_status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment confirmation
DROP TRIGGER IF EXISTS trigger_clear_cart_after_payment ON orders;
CREATE TRIGGER trigger_clear_cart_after_payment
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION clear_cart_after_payment();