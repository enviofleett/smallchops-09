-- Emergency reconciliation for two stuck orders with successful Paystack payments
-- Based on edge function logs showing successful verification

-- Fix Order 1: ORD-20250812-7256 (₦24,990)
DO $$
DECLARE
  v_order_id UUID := '8eb36312-12f9-49b0-82d8-c916b5a4e48c';
  v_old_ref TEXT := 'pay_1755011878315_s9y7ozysa';
  v_new_ref TEXT := 'txn_1755011878315_8eb36312-12f9-49b0-82d8-c916b5a4e48c';
BEGIN
  -- Update order with txn_ reference and mark as paid
  UPDATE orders 
  SET 
    payment_reference = v_new_ref,
    paystack_reference = v_new_ref,
    payment_status = 'paid',
    paid_at = '2025-08-12 15:18:00+00',
    status = 'confirmed',
    updated_at = NOW()
  WHERE id = v_order_id;

  -- Create payment transaction record
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
    v_order_id,
    v_new_ref,
    24990,
    'NGN',
    'paid',
    jsonb_build_object(
      'status', 'success',
      'message', 'Payment verified successfully via emergency reconciliation',
      'original_reference', v_old_ref
    ),
    '2025-08-12 15:18:00+00',
    NOW(),
    '2025-08-12 15:18:00+00'
  ) ON CONFLICT (provider_reference) DO NOTHING;

  -- Log the fix
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'emergency_payment_reconciliation',
    'Payment Recovery',
    'Order reconciled: ORD-20250812-7256 - converted pay_ to txn_ reference',
    jsonb_build_object(
      'order_id', v_order_id,
      'old_reference', v_old_ref,
      'new_reference', v_new_ref,
      'amount', 24990,
      'verified_by_paystack', true
    )
  );
END $$;

-- Fix Order 2: ORD-20250812-7542 (₦74,990)
DO $$
DECLARE
  v_order_id UUID := '62631755-e88f-4dee-9fb5-1d6d1551cf69';
  v_old_ref TEXT := 'pay_1755011801232_yl2ja8jb8';
  v_new_ref TEXT := 'txn_1755011801232_62631755-e88f-4dee-9fb5-1d6d1551cf69';
BEGIN
  -- Update order with txn_ reference and mark as paid
  UPDATE orders 
  SET 
    payment_reference = v_new_ref,
    paystack_reference = v_new_ref,
    payment_status = 'paid',
    paid_at = '2025-08-12 15:17:00+00',
    status = 'confirmed',
    updated_at = NOW()
  WHERE id = v_order_id;

  -- Create payment transaction record
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
    v_order_id,
    v_new_ref,
    74990,
    'NGN',
    'paid',
    jsonb_build_object(
      'status', 'success',
      'message', 'Payment verified successfully via emergency reconciliation',
      'original_reference', v_old_ref
    ),
    '2025-08-12 15:17:00+00',
    NOW(),
    '2025-08-12 15:17:00+00'
  ) ON CONFLICT (provider_reference) DO NOTHING;

  -- Log the fix
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'emergency_payment_reconciliation',
    'Payment Recovery',
    'Order reconciled: ORD-20250812-7542 - converted pay_ to txn_ reference',
    jsonb_build_object(
      'order_id', v_order_id,
      'old_reference', v_old_ref,
      'new_reference', v_new_ref,
      'amount', 74990,
      'verified_by_paystack', true
    )
  );
END $$;