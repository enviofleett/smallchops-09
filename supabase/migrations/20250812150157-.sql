-- Emergency reconciliation for the current pending payment
UPDATE orders 
SET payment_reference = 'txn_1755009711693_18a0385a-ff36-464c-a10c-219f03f8cc1b',
    updated_at = NOW()
WHERE id = '8180c524-667d-430d-be0d-9728e8e35f65';

-- Create the missing payment transaction record
INSERT INTO payment_transactions (
  order_id,
  provider_reference,
  amount,
  currency,
  status,
  provider_response,
  paid_at,
  processed_at,
  created_at
) VALUES (
  '8180c524-667d-430d-be0d-9728e8e35f65',
  'txn_1755009711693_18a0385a-ff36-464c-a10c-219f03f8cc1b',
  24990,
  'NGN',
  'paid',
  '{"status": true, "message": "Emergency reconciliation", "reconciled": true}',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (provider_reference) DO NOTHING;

-- Update order status to paid
UPDATE orders 
SET 
  status = 'confirmed',
  payment_status = 'paid',
  paid_at = NOW(),
  updated_at = NOW()
WHERE id = '8180c524-667d-430d-be0d-9728e8e35f65';

-- Create audit log for the emergency reconciliation
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'emergency_payment_reconciliation',
  'Payment Recovery',
  'Emergency reconciliation: Updated order with correct Paystack reference and marked as paid',
  jsonb_build_object(
    'order_id', '8180c524-667d-430d-be0d-9728e8e35f65',
    'paystack_reference', 'txn_1755009711693_18a0385a-ff36-464c-a10c-219f03f8cc1b',
    'total_amount', 24990,
    'reconciliation_type', 'emergency_fix'
  )
);