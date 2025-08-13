-- Fix the problematic orders that are blocking the migration
-- Set assigned_rider_id for orders that are already in out_for_delivery status

-- Create a dummy rider entry if none exists (for data consistency)
INSERT INTO dispatch_riders (name, phone, email, vehicle_type, is_active, profile_id)
VALUES ('Migration Rider', '+2340000000000', 'migration@example.com', 'motorcycle', false, NULL)
ON CONFLICT (email) DO NOTHING;

-- Update the problematic orders to assign the migration rider
UPDATE orders 
SET assigned_rider_id = (
  SELECT id FROM dispatch_riders WHERE email = 'migration@example.com' LIMIT 1
)
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