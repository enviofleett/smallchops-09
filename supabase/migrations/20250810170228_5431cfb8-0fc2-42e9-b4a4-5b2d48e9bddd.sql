
-- 1) Ensure we’re targeting the correct order and values
WITH o AS (
  SELECT 
    id AS order_id,
    order_number,
    total_amount,
    customer_email,
    customer_name
  FROM orders
  WHERE order_number = 'ORD-20250810-1965'
  LIMIT 1
)

-- 2) Update an existing transaction for the verified reference, if it already exists
UPDATE payment_transactions pt
SET
  order_id = o.order_id,
  transaction_type = 'charge',
  amount = o.total_amount,
  currency = 'NGN',
  status = 'paid',
  channel = COALESCE(pt.channel, 'manual_backfill'),
  gateway_response = COALESCE(pt.gateway_response, 'Backfilled after Paystack verification'),
  paid_at = COALESCE(pt.paid_at, now()),
  processed_at = NULL, -- let triggers process and set processed_at
  customer_email = COALESCE(pt.customer_email, o.customer_email),
  customer_name = COALESCE(pt.customer_name, o.customer_name),
  metadata = COALESCE(pt.metadata, '{}'::jsonb) || jsonb_build_object(
    'order_number', o.order_number,
    'backfill_reason', 'verified reference backfill',
    'canonical_reference', 'pay_1754843938121_7usnwx30o'
  ),
  updated_at = now()
FROM o
WHERE pt.provider_reference = 'pay_1754843938121_7usnwx30o';

-- 3) Insert the transaction if it does not exist yet
INSERT INTO payment_transactions (
  order_id,
  transaction_type,
  amount,
  currency,
  status,
  channel,
  gateway_response,
  paid_at,
  processed_at,
  provider_reference,
  customer_email,
  customer_name,
  metadata,
  created_at,
  updated_at
)
SELECT
  o.order_id,
  'charge',
  o.total_amount,
  'NGN',
  'paid',
  'manual_backfill',
  'Backfilled after Paystack verification',
  now(),
  NULL, -- allow triggers to process and set processed_at
  'pay_1754843938121_7usnwx30o',
  o.customer_email,
  o.customer_name,
  jsonb_build_object(
    'order_number', o.order_number,
    'backfill_reason', 'verified reference backfill',
    'canonical_reference', 'pay_1754843938121_7usnwx30o'
  ),
  now(),
  now()
FROM o
WHERE NOT EXISTS (
  SELECT 1 FROM payment_transactions WHERE provider_reference = 'pay_1754843938121_7usnwx30o'
);

-- 4) Point the order at the verified (canonical) reference
UPDATE orders
SET
  payment_reference = 'pay_1754843938121_7usnwx30o',
  updated_at = now()
WHERE id IN (SELECT order_id FROM o);
