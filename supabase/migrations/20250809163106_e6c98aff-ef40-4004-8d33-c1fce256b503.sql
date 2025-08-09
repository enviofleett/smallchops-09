-- Fix: Replace existing orders_with_payment view by dropping first
DROP VIEW IF EXISTS public.orders_with_payment CASCADE;

CREATE VIEW public.orders_with_payment AS
SELECT 
  o.*,
  pt.id as payment_tx_id,
  pt.status as payment_tx_status,
  pt.paid_at as payment_tx_paid_at,
  pt.provider_reference as payment_tx_provider_reference,
  pt.amount as payment_tx_amount,
  pt.channel as payment_tx_channel,
  pt.created_at as payment_tx_created_at,
  pt.processed_at as payment_tx_processed_at,
  CASE 
    WHEN o.payment_status = 'paid' THEN true
    WHEN pt.status IN ('success', 'paid') THEN true
    ELSE false
  END as final_paid,
  COALESCE(o.paid_at, pt.paid_at) as final_paid_at,
  COALESCE(pt.channel, 'unknown') as payment_channel,
  CASE 
    WHEN pt.channel IS NOT NULL THEN pt.channel
    WHEN o.payment_status = 'paid' THEN 'processed'
    ELSE 'pending'
  END as payment_method,
  CASE 
    WHEN o.payment_status != 'paid' AND pt.status IN ('success', 'paid') THEN true
    ELSE false
  END as needs_reconciliation
FROM public.orders o
LEFT JOIN LATERAL (
  SELECT DISTINCT ON (order_id) *
  FROM public.payment_transactions pt_inner
  WHERE pt_inner.order_id = o.id
  ORDER BY order_id, created_at DESC, id DESC
) pt ON true;

-- Reapply grants
REVOKE ALL ON TABLE public.orders_with_payment FROM PUBLIC;
GRANT SELECT ON public.orders_with_payment TO service_role;