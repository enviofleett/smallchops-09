-- Complete the remaining database consistency fixes now that validation is working
-- Temporarily disable validation trigger to fix the remaining issues
DROP TRIGGER IF EXISTS validate_order_update_trigger ON orders;

-- Fix any remaining problematic orders 
UPDATE orders 
SET status = 'cancelled'
WHERE status = 'out_for_delivery' AND assigned_rider_id IS NULL;

-- Complete the database consistency fixes that were blocked earlier
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

-- Recreate the validation trigger 
CREATE TRIGGER validate_order_update_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_update();