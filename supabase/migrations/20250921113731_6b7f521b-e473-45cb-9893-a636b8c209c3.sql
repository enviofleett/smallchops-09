-- URGENT PRODUCTION FIX: Process stuck payment and update order status
-- This payment is stuck and needs manual processing

-- Process the stuck payment: txn_1758453954445_fe843be1
UPDATE orders 
SET 
  status = 'confirmed',
  payment_status = 'paid',
  payment_verified_at = NOW(),
  updated_at = NOW(),
  updated_by = (SELECT id FROM profiles WHERE email = 'toolbuxdev@gmail.com' LIMIT 1)
WHERE payment_reference = 'txn_1758453954445_fe843be1'
  AND status = 'pending';

-- Create payment transaction record
INSERT INTO payment_transactions (
  reference,
  provider_reference,
  order_id,
  amount,
  amount_kobo,
  currency,
  status,
  provider,
  customer_email,
  gateway_response,
  paid_at,
  created_at,
  updated_at
) 
SELECT 
  'txn_1758453954445_fe843be1',
  'txn_1758453954445_fe843be1',
  o.id,
  o.total_amount,
  (o.total_amount * 100)::integer,
  'NGN',
  'completed',
  'paystack',
  o.customer_email,
  '{"status": "success", "amount": 10000, "manually_processed": true, "processed_at": "' || NOW()::text || '"}'::jsonb,
  NOW(),
  NOW(),
  NOW()
FROM orders o
WHERE o.payment_reference = 'txn_1758453954445_fe843be1'
ON CONFLICT (reference) DO UPDATE SET
  status = 'completed',
  gateway_response = EXCLUDED.gateway_response,
  updated_at = NOW();

-- Log the manual processing
INSERT INTO audit_logs (action, category, message, entity_id, new_values)
SELECT 
  'manual_payment_processing',
  'Payment Recovery',
  'Manually processed stuck payment: ' || o.order_number,
  o.id,
  jsonb_build_object(
    'payment_reference', 'txn_1758453954445_fe843be1',
    'amount', o.total_amount,
    'processed_by', 'system_recovery',
    'reason', 'stuck_payment_after_database_field_fix'
  )
FROM orders o
WHERE o.payment_reference = 'txn_1758453954445_fe843be1';