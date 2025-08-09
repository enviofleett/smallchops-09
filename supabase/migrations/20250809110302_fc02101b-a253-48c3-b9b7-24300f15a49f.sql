-- Targeted backfill for the two provided Paystack references
DO $$
DECLARE
    ref TEXT;
    refs TEXT[] := ARRAY[
      'pay_1754729229192_v4v1nkr25',
      'pay_1754726352700_95mtml5bf'
    ];
    o RECORD;
BEGIN
  FOREACH ref IN ARRAY refs
  LOOP
    RAISE NOTICE 'Processing reference: %', ref;

    SELECT id, payment_status, status, total_amount
    INTO o
    FROM public.orders
    WHERE payment_reference = ref
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE NOTICE 'No order found for reference: %', ref;
      CONTINUE;
    END IF;

    -- Update order to paid/confirmed (idempotent)
    UPDATE public.orders
    SET
      payment_status = 'paid',
      status = 'confirmed',
      paid_at = COALESCE(paid_at, NOW()),
      updated_at = NOW()
    WHERE id = o.id;

    -- Upsert payment transaction (idempotent)
    INSERT INTO public.payment_transactions (
      provider_reference,
      transaction_type,
      amount,
      currency,
      status,
      order_id,
      created_at,
      updated_at
    )
    VALUES (
      ref,
      'charge',
      o.total_amount,
      'NGN',
      'paid',
      o.id,
      NOW(),
      NOW()
    )
    ON CONFLICT (provider_reference) DO UPDATE
    SET
      status = 'paid',
      amount = COALESCE(public.payment_transactions.amount, EXCLUDED.amount),
      order_id = COALESCE(public.payment_transactions.order_id, EXCLUDED.order_id),
      updated_at = NOW();

    RAISE NOTICE 'Order % updated and payment transaction upserted for reference %', o.id, ref;
  END LOOP;
END $$;