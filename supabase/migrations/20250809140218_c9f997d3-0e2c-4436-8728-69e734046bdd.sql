-- One-time backfill: link past successful transactions to orders
WITH matched AS (
  SELECT t.id AS tx_id, o.id AS order_id
  FROM public.payment_transactions t
  JOIN public.orders o ON (
    (t.metadata ? 'order_id' AND (t.metadata->>'order_id')::uuid = o.id)
    OR (t.provider_reference IS NOT NULL AND o.payment_reference = t.provider_reference)
    OR (t.metadata ? 'order_number' AND o.order_number = t.metadata->>'order_number')
  )
  WHERE t.status IN ('success','paid')
    AND t.order_id IS NULL
)
UPDATE public.payment_transactions t
SET order_id = m.order_id,
    updated_at = now()
FROM matched m
WHERE t.id = m.tx_id;

-- Backfill orders to paid where a linked successful transaction exists
UPDATE public.orders o
SET 
  payment_status = 'paid',
  paid_at = COALESCE(o.paid_at, t.paid_at, now()),
  status = CASE 
    WHEN o.status IN ('pending','processing','confirmed','preparing') THEN 'confirmed'
    ELSE o.status
  END,
  updated_at = now()
FROM public.payment_transactions t
WHERE t.order_id = o.id
  AND t.status IN ('success','paid')
  AND (o.payment_status IS DISTINCT FROM 'paid' OR o.paid_at IS NULL);