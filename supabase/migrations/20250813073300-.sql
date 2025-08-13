-- Fix the problematic orders by setting them back to a valid status
-- Since they don't have assigned riders, set them back to 'confirmed'

UPDATE orders 
SET 
    status = 'confirmed',
    updated_at = NOW()
WHERE status = 'out_for_delivery' AND assigned_rider_id IS NULL;

-- Now complete the database consistency fixes
-- Backfill missing paystack_reference values
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

-- Create index for better payment verification performance
CREATE INDEX IF NOT EXISTS idx_orders_payment_references 
ON orders (payment_reference, paystack_reference) 
WHERE payment_reference IS NOT NULL;