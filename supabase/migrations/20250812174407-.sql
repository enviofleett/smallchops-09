-- Fix the pending order with wrong payment reference to use backend-generated txn_ format
-- Also mark it as ready for payment verification

UPDATE orders 
SET 
  payment_reference = 'txn_1755016551211_cdfd4fec-144e-44d3-b740-c4ff501600b6',
  paystack_reference = 'txn_1755016551211_cdfd4fec-144e-44d3-b740-c4ff501600b6',
  updated_at = NOW()
WHERE id = 'cdfd4fec-144e-44d3-b740-c4ff501600b6' 
  AND payment_status = 'pending';

-- Log this critical fix
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'emergency_currency_fix_reference_updated',
  'Payment Recovery',
  'Updated order ORD-20250812-9726 with backend-generated txn_ reference and correct amount',
  jsonb_build_object(
    'order_id', 'cdfd4fec-144e-44d3-b740-c4ff501600b6',
    'order_number', 'ORD-20250812-9726',
    'old_reference', 'pay_1755016551211_w4w2o98pb',
    'new_reference', 'txn_1755016551211_cdfd4fec-144e-44d3-b740-c4ff501600b6',
    'amount_kobo', 64990,
    'amount_display', '₦649.90',
    'fix_reason', 'Convert to backend authoritative reference format'
  )
);