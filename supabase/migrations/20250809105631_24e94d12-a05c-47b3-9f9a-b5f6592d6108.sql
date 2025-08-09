
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

-- 3) Quick verification queries (safe to run after the DO block)
-- Check the two references reflect paid/confirmed and a transaction exists
-- SELECT 
--   o.id, o.order_number, o.payment_status, o.status, o.payment_reference, o.paid_at,
--   pt.provider_reference, pt.amount, pt.status AS transaction_status
-- FROM public.orders o
-- LEFT JOIN public.payment_transactions pt
--   ON o.payment_reference = pt.provider_reference
-- WHERE o.payment_reference IN (
--   'pay_1754730907804_704m4ph3o',
--   'pay_1754729858007_pe4zpafsq'
-- );

-- Check payment confirmation events (if your triggers are active, these should exist)
-- SELECT 
--   ce.event_type, ce.status, ce.created_at, ce.order_id, o.payment_reference
-- FROM public.communication_events ce
-- JOIN public.orders o ON ce.order_id = o.id
-- WHERE o.payment_reference IN (
--   'pay_1754730907804_704m4ph3o',
--   'pay_1754729858007_pe4zpafsq'
-- )
-- AND ce.event_type = 'payment_confirmation'
-- ORDER BY ce.created_at DESC;
