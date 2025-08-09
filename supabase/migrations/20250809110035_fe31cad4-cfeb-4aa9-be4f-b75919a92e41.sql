-- 1) Add orders.paid_at safely and index it (idempotent)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_paid_at
  ON public.orders(paid_at)
  WHERE paid_at IS NOT NULL;

-- 2) Targeted backfill for two specific Paystack references
-- This will:
-- - Locate the order by payment_reference
-- - Mark it paid/confirmed if not already
-- - Set paid_at
-- - Upsert a payment_transactions row with status 'paid'
DO $$
DECLARE
    ref TEXT;
    refs TEXT[] := ARRAY[
      'pay_1754730907804_704m4ph3o',
      'pay_1754729858007_pe4zpafsq'
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
      o.total_amount,       -- fallback: use order total if Paystack amount unknown here
      'NGN',
      'paid',
      o.id,
      NOW(),
      NOW()
    )
    ON CONFLICT (provider_reference) DO UPDATE
    SET
      status = EXCLUDED.status,
      amount = COALESCE(public.payment_transactions.amount, EXCLUDED.amount),
      order_id = COALESCE(public.payment_transactions.order_id, EXCLUDED.order_id),
      updated_at = NOW();

    RAISE NOTICE 'Order % updated and payment transaction upserted for reference %', o.id, ref;
  END LOOP;
END $$;