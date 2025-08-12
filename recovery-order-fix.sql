-- Recovery script for the specific pending order ORD-20250812-1434
-- This will attempt to recover the order if the Paystack payment actually went through

-- First check if the Paystack payment was successful for pay_1755020881006_zo5vbldke
-- Then update the order accordingly

UPDATE orders 
SET 
  payment_reference = 'txn_1755020881006_72b549c3-afe7-4ceb-89d7-819de3d2e3da',
  paystack_reference = 'pay_1755020881006_zo5vbldke',
  updated_at = NOW()
WHERE order_number = 'ORD-20250812-1434';