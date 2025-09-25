-- Fix payment_transactions status constraint to include all valid statuses
ALTER TABLE payment_transactions 
DROP CONSTRAINT IF EXISTS payment_transactions_status_check;

ALTER TABLE payment_transactions 
ADD CONSTRAINT payment_transactions_status_check 
CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'processing', 'refunded'));

-- Ensure payment_reference column exists and is indexed for fast lookups
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON orders(payment_reference);

-- Add comments for clarity
COMMENT ON COLUMN orders.payment_reference IS 'Payment reference from payment provider (e.g., Paystack)';
COMMENT ON INDEX idx_orders_payment_reference IS 'Index for fast payment reference lookups during callbacks';