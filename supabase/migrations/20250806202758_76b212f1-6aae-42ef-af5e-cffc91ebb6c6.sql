-- Fix the trigger issue by updating orders manually without triggering status change emails
-- Update payment transactions to success
UPDATE payment_transactions 
SET 
  status = 'success',
  paid_at = NOW(),
  processed_at = NOW(),
  updated_at = NOW()
WHERE status = 'pending'
AND created_at >= NOW() - INTERVAL '24 hours'
AND provider_reference IS NOT NULL;

-- Update corresponding orders to paid status manually
UPDATE orders 
SET 
  payment_status = 'paid',
  updated_at = NOW()
WHERE payment_status = 'pending'
AND id IN (
  SELECT DISTINCT order_id 
  FROM payment_transactions 
  WHERE status = 'success' 
  AND order_id IS NOT NULL
);

-- Log the manual update
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'manual_payment_status_update',
  'Payment Processing',
  'Manually updated payment statuses from pending to success',
  jsonb_build_object(
    'timestamp', NOW(),
    'reason', 'Fixed payment status display issue'
  )
);