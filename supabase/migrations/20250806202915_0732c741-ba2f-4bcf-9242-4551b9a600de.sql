-- Now create the correct constraint that matches the payment_status enum
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_status_check 
CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded'));

-- Update payment transactions to 'paid' status (this matches the enum)
UPDATE payment_transactions 
SET 
  status = 'paid',
  paid_at = NOW(),
  processed_at = NOW(),
  updated_at = NOW()
WHERE status = 'pending'
AND created_at >= NOW() - INTERVAL '24 hours'
AND provider_reference IS NOT NULL;

-- Update corresponding orders to paid status
UPDATE orders 
SET 
  payment_status = 'paid',
  updated_at = NOW()
WHERE payment_status = 'pending'
AND id IN (
  SELECT DISTINCT order_id 
  FROM payment_transactions 
  WHERE status = 'paid' 
  AND order_id IS NOT NULL
);