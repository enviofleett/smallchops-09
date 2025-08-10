-- Reconcile orders safely: only update rows that won't violate validation trigger
UPDATE public.orders AS o
SET 
  payment_status = 'paid',
  status = CASE 
    WHEN o.status = 'pending' THEN 'confirmed' 
    ELSE o.status 
  END,
  payment_reference = COALESCE(pt.provider_reference, o.payment_reference),
  paid_at = COALESCE(o.paid_at, pt.paid_at, pt.updated_at, now()),
  updated_at = now()
FROM public.payment_transactions AS pt
WHERE pt.order_id = o.id
  AND pt.status IN ('success','paid')
  AND (
    o.payment_status IS DISTINCT FROM 'paid' 
    OR o.payment_reference IS DISTINCT FROM pt.provider_reference
  )
  AND NOT (o.status IN ('out_for_delivery','delivered','completed') AND o.assigned_rider_id IS NULL);