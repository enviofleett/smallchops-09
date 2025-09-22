-- URGENT PRODUCTION FIX: Process stuck payment (retry with fixed audit function)
-- Now that triggers are fixed, process the stuck payment: txn_1758453954445_fe843be1

-- Get the admin user ID for proper tracking
WITH admin_user AS (
  SELECT id, email FROM profiles WHERE email = 'toolbuxdev@gmail.com' LIMIT 1
)
-- Process the stuck payment
UPDATE orders 
SET 
  status = 'confirmed',
  payment_status = 'paid',
  payment_verified_at = NOW(),
  updated_at = NOW(),
  updated_by = (SELECT id FROM admin_user)
FROM admin_user
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

-- Create email notification for customer
INSERT INTO communication_events (
  event_type,
  recipient_email,
  template_key,
  template_variables,
  status,
  order_id,
  dedupe_key,
  source,
  priority,
  created_at,
  updated_at
)
SELECT 
  'payment_confirmation',
  o.customer_email,
  'order_confirmed',
  jsonb_build_object(
    'customer_name', COALESCE(o.customer_name, 'Customer'),
    'order_number', o.order_number,
    'total_amount', o.total_amount,
    'status', 'confirmed'
  ),
  'queued',
  o.id,
  'manual_payment_recovery_' || o.id::text || '_' || EXTRACT(EPOCH FROM NOW())::text,
  'manual_recovery',
  'high',
  NOW(),
  NOW()
FROM orders o
WHERE o.payment_reference = 'txn_1758453954445_fe843be1'
  AND o.customer_email IS NOT NULL;