-- Phase 1: Fix invalid enum value and add proper order status handling
-- Update order_status enum to include 'failed' if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'failed' 
        AND enumtypid = 'order_status'::regtype
    ) THEN
        ALTER TYPE order_status ADD VALUE 'failed';
    END IF;
END $$;

-- Phase 3: Database consistency fix - backfill missing paystack_reference values
UPDATE orders 
SET 
    paystack_reference = payment_reference,
    updated_at = NOW()
WHERE 
    payment_reference IS NOT NULL 
    AND (paystack_reference IS NULL OR paystack_reference = '');

-- Ensure payment_transactions are properly linked to orders
UPDATE payment_transactions pt
SET order_id = o.id
FROM orders o
WHERE pt.order_id IS NULL 
    AND pt.provider_reference = o.payment_reference;

-- Add database constraints to prevent future reference mismatches
ALTER TABLE orders 
ADD CONSTRAINT check_reference_consistency 
CHECK (
    (payment_reference IS NULL AND paystack_reference IS NULL) OR
    (payment_reference IS NOT NULL AND paystack_reference IS NOT NULL)
);

-- Create index for better payment verification performance
CREATE INDEX IF NOT EXISTS idx_orders_payment_references 
ON orders (payment_reference, paystack_reference) 
WHERE payment_reference IS NOT NULL;