-- Phase 1: Complete Customer ID System Fix

-- First, temporarily make customer_id nullable to avoid constraint issues
ALTER TABLE orders ALTER COLUMN customer_id DROP NOT NULL;

-- Drop the foreign key constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_customer_id_fkey' 
    AND table_name = 'orders'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_customer_id_fkey;
  END IF;
END $$;

-- Update orders to link to customer_accounts using email matching
UPDATE orders 
SET customer_id = ca.id,
    updated_at = NOW()
FROM customer_accounts ca
JOIN auth.users u ON ca.user_id = u.id
WHERE orders.customer_email = u.email 
  AND orders.customer_id IS DISTINCT FROM ca.id;

-- Also match by ca.email if it exists
UPDATE orders 
SET customer_id = ca.id,
    updated_at = NOW()
FROM customer_accounts ca
WHERE orders.customer_email = ca.email 
  AND orders.customer_id IS DISTINCT FROM ca.id
  AND ca.email IS NOT NULL;

-- Add proper foreign key constraint to customer_accounts
ALTER TABLE orders 
ADD CONSTRAINT orders_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES customer_accounts(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);