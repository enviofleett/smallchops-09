-- First check the current constraint on payment_transactions
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_status_check;

-- Add the correct constraint that includes 'success' as a valid status
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_status_check 
CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled', 'refunded'));

-- Now run the bulk update function
SELECT bulk_update_payment_status_to_success();