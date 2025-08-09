-- Ensure required column exists for payment processing
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Retry targeted backfill for one order/reference
DO $$
DECLARE
  v_order RECORD;
  v_ref CONSTANT text := 'pay_1754730907120_4xnuf1zgv';
  v_order_number CONSTANT text := 'ORD-20250809-2177';
BEGIN
  -- Fetch the order
  SELECT id, total_amount INTO v_order
  FROM public.orders
  WHERE order_number = v_order_number
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order with number % not found', v_order_number;
  END IF;

  -- Ensure the order has the correct payment reference stored
  UPDATE public.orders
  SET payment_reference = v_ref,
      updated_at = NOW()
  WHERE id = v_order.id AND COALESCE(payment_reference, '') <> v_ref;

  -- Upsert a placeholder payment transaction so handle_successful_payment can update it
  INSERT INTO public.payment_transactions (
    provider_reference,
    transaction_type,
    amount,
    currency,
    status,
    order_id,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    v_ref,
    'charge',
    v_order.total_amount,
    'NGN',
    'pending',
    v_order.id,
    jsonb_build_object('source', 'manual_backfill'),
    NOW(),
    NOW()
  )
  ON CONFLICT (provider_reference) DO NOTHING;

  -- Mark as paid and confirm the order via existing production-safe function
  PERFORM public.handle_successful_payment(
    v_ref,
    NOW(),
    'Manual backfill confirmation',
    0,
    'manual_backfill',
    NULL, NULL, NULL, NULL, NULL, NULL
  );

  -- Ensure paid_at is set for reporting (idempotent)
  UPDATE public.orders
  SET paid_at = COALESCE(paid_at, NOW()),
      updated_at = NOW()
  WHERE id = v_order.id;
END $$;