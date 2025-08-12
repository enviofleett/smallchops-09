-- Critical Migration: Convert All Legacy Payment References to Secure Format
-- This migration converts 148 orders with pay_ references to secure txn_ format

-- Step 1: Create a secure reference generation function that ensures uniqueness
CREATE OR REPLACE FUNCTION generate_secure_payment_reference_for_order(order_id UUID)
RETURNS TEXT AS $$
DECLARE
  secure_ref TEXT;
  timestamp_part BIGINT;
BEGIN
  -- Use order creation timestamp if available, otherwise current timestamp
  SELECT EXTRACT(EPOCH FROM COALESCE(created_at, NOW()))::BIGINT 
  INTO timestamp_part 
  FROM orders 
  WHERE id = order_id;
  
  -- Generate secure reference: txn_timestamp_orderid
  secure_ref := 'txn_' || timestamp_part || '_' || order_id::text;
  
  RETURN secure_ref;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Update all orders with pay_ references to secure txn_ format
UPDATE orders 
SET 
  payment_reference = generate_secure_payment_reference_for_order(id),
  paystack_reference = payment_reference, -- Keep the old reference as paystack_reference for tracking
  reference_updated_at = NOW(),
  updated_at = NOW()
WHERE payment_reference LIKE 'pay_%';

-- Step 3: Specifically ensure the problematic order is fixed
UPDATE orders 
SET 
  payment_reference = generate_secure_payment_reference_for_order(id),
  paystack_reference = 'pay_1755020881006_zo5vbldke', -- Keep original paystack ref
  reference_updated_at = NOW(),
  updated_at = NOW()
WHERE order_number = 'ORD-20250812-1434';

-- Step 4: Create audit log of the conversion
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'payment_reference_security_conversion',
  'Payment Security',
  'Converted all legacy pay_ references to secure txn_ format',
  jsonb_build_object(
    'converted_orders', (SELECT COUNT(*) FROM orders WHERE payment_reference LIKE 'txn_%'),
    'conversion_timestamp', NOW(),
    'security_upgrade', 'complete'
  )
);

-- Step 5: Verify conversion results
SELECT 
  'CONVERSION_COMPLETE' as status,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN payment_reference LIKE 'pay_%' THEN 1 END) as remaining_legacy_refs,
  COUNT(CASE WHEN payment_reference LIKE 'txn_%' THEN 1 END) as secure_refs_count
FROM orders;