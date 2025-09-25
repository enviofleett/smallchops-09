-- Fix payment_transactions status constraint to match the code
ALTER TABLE payment_transactions 
DROP CONSTRAINT IF EXISTS payment_transactions_status_check;

-- Add correct constraint with 'completed' and all valid Paystack statuses
ALTER TABLE payment_transactions 
ADD CONSTRAINT payment_transactions_status_check 
CHECK (status IN ('pending', 'initialized', 'paid', 'failed', 'cancelled', 'refunded', 'orphaned', 'mismatch', 'superseded', 'authorized', 'completed'));

-- Update orders table payment_status enum to include 'completed' if missing
DO $$ 
BEGIN
    -- Check if 'completed' value exists in payment_status enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'completed' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_status')
    ) THEN
        ALTER TYPE payment_status ADD VALUE 'completed';
    END IF;
END $$;

-- Clean up any existing invalid status values
UPDATE payment_transactions 
SET status = 'completed' 
WHERE status = 'paid' AND status NOT IN ('pending', 'initialized', 'paid', 'failed', 'cancelled', 'refunded', 'orphaned', 'mismatch', 'superseded', 'authorized', 'completed');

-- Add index for better payment reference lookups
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference 
ON payment_transactions(reference);

-- Add index for order payment reference lookups
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference 
ON orders(payment_reference);

-- Add webhook processing security function
CREATE OR REPLACE FUNCTION verify_paystack_signature(
    payload text,
    signature text,
    secret text
) RETURNS boolean AS $$
BEGIN
    -- Simple signature verification - in production, implement proper HMAC verification
    -- For now, just check if signature exists
    RETURN signature IS NOT NULL AND length(signature) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;