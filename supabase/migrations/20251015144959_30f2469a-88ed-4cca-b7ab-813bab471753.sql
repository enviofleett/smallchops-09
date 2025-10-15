-- Add transaction_fee column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS transaction_fee NUMERIC(10, 2) DEFAULT 0;

-- Add index for analytics
CREATE INDEX IF NOT EXISTS idx_orders_transaction_fee 
ON orders(transaction_fee) WHERE transaction_fee > 0;

-- Update existing orders to have 0 transaction fee
UPDATE orders SET transaction_fee = 0 WHERE transaction_fee IS NULL;

COMMENT ON COLUMN orders.transaction_fee IS 'Paystack transaction fee passed to customer (1.5% + ₦100, capped at ₦2,000)';