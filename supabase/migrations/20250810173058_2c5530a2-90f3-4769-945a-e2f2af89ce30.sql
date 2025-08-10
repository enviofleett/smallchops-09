-- Backfill and force-confirm two recent orders using canonical Paystack references
DO $$
DECLARE
  v_now timestamptz := now();
  -- Order 1 (ORD-20250810-867)
  v_order1_id uuid := 'fb8428f3-fa4a-433c-ab34-826ff566a725';
  v_ref1 text := 'pay_1754846022795_piuxk2665'; -- canonical newer reference
  v_ord1_amount numeric;
  v_ord1_number text;
  v_txn1_id uuid;
  -- Order 2 (ORD-20250810-7591)
  v_order2_id uuid := '4e97ffa9-a178-48e1-a4a0-e5550d14905e';
  v_ref2 text := 'pay_1754830436091_r8rw165zx';
  v_ord2_amount numeric;
  v_ord2_number text;
  v_txn2_id uuid;
BEGIN
  -- Fetch order 1 details
  SELECT total_amount, order_number INTO v_ord1_amount, v_ord1_number
  FROM orders WHERE id = v_order1_id;

  -- Upsert payment transaction for order 1
  SELECT id INTO v_txn1_id FROM payment_transactions WHERE provider_reference = v_ref1 LIMIT 1;

  IF v_txn1_id IS NULL THEN
    INSERT INTO payment_transactions (
      order_id, provider, provider_reference, amount, currency, status, paid_at,
      channel, gateway_response, processed_at, metadata, created_at, updated_at
    ) VALUES (
      v_order1_id, 'paystack', v_ref1, v_ord1_amount, 'NGN', 'paid', v_now,
      'online', 'Backfill force-confirm via admin request', v_now,
      jsonb_build_object('order_number', v_ord1_number, 'canonical_reference', v_ref1, 'backfill', true),
      v_now, v_now
    );
  ELSE
    UPDATE payment_transactions
    SET 
      order_id = COALESCE(order_id, v_order1_id),
      status = 'paid',
      paid_at = COALESCE(paid_at, v_now),
      amount = COALESCE(amount, v_ord1_amount),
      currency = COALESCE(currency, 'NGN'),
      channel = COALESCE(channel, 'online'),
      gateway_response = COALESCE(gateway_response, 'Backfill force-confirm via admin request'),
      processed_at = COALESCE(processed_at, v_now),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('order_number', v_ord1_number, 'canonical_reference', v_ref1, 'backfill', true),
      updated_at = v_now
    WHERE id = v_txn1_id;
  END IF;

  -- Update order 1 to paid/confirmed and set canonical reference
  UPDATE orders
  SET 
    payment_status = 'paid',
    status = 'confirmed',
    payment_reference = v_ref1,
    paid_at = COALESCE(paid_at, v_now),
    updated_at = v_now
  WHERE id = v_order1_id;

  -- Fetch order 2 details
  SELECT total_amount, order_number INTO v_ord2_amount, v_ord2_number
  FROM orders WHERE id = v_order2_id;

  -- Upsert payment transaction for order 2
  SELECT id INTO v_txn2_id FROM payment_transactions WHERE provider_reference = v_ref2 LIMIT 1;

  IF v_txn2_id IS NULL THEN
    INSERT INTO payment_transactions (
      order_id, provider, provider_reference, amount, currency, status, paid_at,
      channel, gateway_response, processed_at, metadata, created_at, updated_at
    ) VALUES (
      v_order2_id, 'paystack', v_ref2, v_ord2_amount, 'NGN', 'paid', v_now,
      'online', 'Backfill force-confirm via admin request', v_now,
      jsonb_build_object('order_number', v_ord2_number, 'canonical_reference', v_ref2, 'backfill', true),
      v_now, v_now
    );
  ELSE
    UPDATE payment_transactions
    SET 
      order_id = COALESCE(order_id, v_order2_id),
      status = 'paid',
      paid_at = COALESCE(paid_at, v_now),
      amount = COALESCE(amount, v_ord2_amount),
      currency = COALESCE(currency, 'NGN'),
      channel = COALESCE(channel, 'online'),
      gateway_response = COALESCE(gateway_response, 'Backfill force-confirm via admin request'),
      processed_at = COALESCE(processed_at, v_now),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('order_number', v_ord2_number, 'canonical_reference', v_ref2, 'backfill', true),
      updated_at = v_now
    WHERE id = v_txn2_id;
  END IF;

  -- Update order 2 to paid/confirmed (keep its existing reference which already matches v_ref2)
  UPDATE orders
  SET 
    payment_status = 'paid',
    status = 'confirmed',
    paid_at = COALESCE(paid_at, v_now),
    updated_at = v_now
  WHERE id = v_order2_id;

END $$;