-- Fix the guest_session_id UUID constraint with proper view handling
-- Drop all dependent views with CASCADE to handle dependencies
DROP VIEW IF EXISTS app.orders_with_payment CASCADE;
DROP VIEW IF EXISTS private.orders_with_payment CASCADE;

-- Now update the orders table to allow text guest_session_id  
ALTER TABLE orders ALTER COLUMN guest_session_id TYPE TEXT;

-- Recreate only the essential view without column duplication
-- Check if payment_reference already exists in orders table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'payment_reference' 
    AND table_schema = 'public'
  ) THEN
    -- Create view with payment_reference from payment_transactions
    CREATE OR REPLACE VIEW app.orders_with_payment AS
    SELECT 
      o.*,
      pt.reference as payment_reference,
      pt.status as payment_transaction_status,
      pt.amount as payment_amount
    FROM orders o
    LEFT JOIN payment_transactions pt ON o.id = pt.order_id;
  ELSE
    -- Create view without payment_reference to avoid duplication
    CREATE OR REPLACE VIEW app.orders_with_payment AS
    SELECT 
      o.*,
      pt.status as payment_transaction_status,
      pt.amount as payment_amount
    FROM orders o
    LEFT JOIN payment_transactions pt ON o.id = pt.order_id;
  END IF;
END $$;