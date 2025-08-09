-- Fix: Add LANGUAGE plpgsql to created functions

CREATE OR REPLACE FUNCTION public.reconcile_payment_status(p_order_id UUID DEFAULT NULL)
RETURNS TABLE(
  order_id UUID,
  was_updated BOOLEAN,
  old_payment_status TEXT,
  new_payment_status TEXT,
  old_order_status TEXT,
  new_order_status TEXT
)
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_cursor CURSOR(order_filter UUID) FOR
    SELECT o.id, o.payment_status, o.status,
           COUNT(pt.*) FILTER (WHERE pt.status IN ('success', 'paid')) as successful_payments
    FROM orders o
    LEFT JOIN payment_transactions pt ON o.id = pt.order_id
    WHERE (order_filter IS NULL OR o.id = order_filter)
      AND o.payment_status != 'paid'
    GROUP BY o.id, o.payment_status, o.status
    HAVING COUNT(pt.*) FILTER (WHERE pt.status IN ('success', 'paid')) > 0;
  order_rec RECORD;
  old_payment_status TEXT;
  old_order_status TEXT;
  new_order_status TEXT;
BEGIN
  FOR order_rec IN order_cursor(p_order_id) LOOP
    old_payment_status := order_rec.payment_status;
    old_order_status := order_rec.status;
    new_order_status := CASE WHEN order_rec.status = 'pending' THEN 'confirmed' ELSE order_rec.status END;
    UPDATE orders SET payment_status='paid', status=new_order_status, paid_at=COALESCE(paid_at, NOW()), updated_at=NOW() WHERE id=order_rec.id;
    INSERT INTO system_logs (event_type, data, created_at)
    VALUES ('payment_reconciliation', jsonb_build_object(
      'order_id', order_rec.id,
      'old_payment_status', old_payment_status,
      'new_payment_status', 'paid',
      'old_order_status', old_order_status,
      'new_order_status', new_order_status,
      'successful_payments', order_rec.successful_payments
    ), NOW()) ON CONFLICT DO NOTHING;
    order_id := order_rec.id; was_updated := true; new_payment_status := 'paid';
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.check_payment_system_health()
RETURNS TABLE(metric TEXT, value BIGINT, description TEXT)
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY SELECT 'inconsistent_orders', COUNT(*), 'Orders with successful payments but payment_status != paid'
  FROM orders o WHERE EXISTS (SELECT 1 FROM payment_transactions pt WHERE pt.order_id=o.id AND pt.status IN ('success','paid')) AND o.payment_status!='paid';

  RETURN QUERY SELECT 'pending_emails', COUNT(*), 'Payment/order emails with status = queued' FROM communication_events
  WHERE event_type IN ('payment_confirmation','order_status_update') AND status='queued';

  RETURN QUERY SELECT 'unprocessed_transactions', COUNT(*), 'Successful transactions with processed_at NULL' FROM payment_transactions
  WHERE status IN ('success','paid') AND processed_at IS NULL;

  RETURN QUERY SELECT 'reconciliations_24h', COUNT(*), 'Payment reconciliations in last 24 hours' FROM system_logs
  WHERE event_type='payment_reconciliation' AND created_at>NOW()-INTERVAL '24 hours';

  RETURN;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_order_payment_status(p_order_id UUID)
RETURNS TABLE(
  order_id UUID,
  payment_status TEXT,
  order_status TEXT,
  paid_at TIMESTAMPTZ,
  final_paid BOOLEAN,
  final_paid_at TIMESTAMPTZ,
  payment_channel TEXT,
  computed_payment_method TEXT,
  needs_reconciliation BOOLEAN,
  latest_tx_status TEXT,
  latest_tx_reference TEXT
)
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    owp.id,
    owp.payment_status,
    owp.status,
    owp.paid_at,
    owp.final_paid,
    owp.final_paid_at,
    owp.payment_channel,
    owp.computed_payment_method,
    owp.needs_reconciliation,
    owp.payment_tx_status,
    owp.payment_tx_provider_reference
  FROM public.orders_with_payment owp
  WHERE owp.id = p_order_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.order_needs_reconciliation(p_order_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE result BOOLEAN; BEGIN
  SELECT CASE WHEN o.payment_status!='paid' AND EXISTS(SELECT 1 FROM payment_transactions pt WHERE pt.order_id=o.id AND pt.status IN ('success','paid')) THEN true ELSE false END
  INTO result FROM orders o WHERE o.id=p_order_id; RETURN COALESCE(result,false); END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.reconcile_payment_status_batch(p_limit INTEGER DEFAULT 100)
RETURNS TABLE(orders_processed INTEGER, orders_updated INTEGER, processing_time_ms INTEGER)
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE start_time TIMESTAMPTZ; end_time TIMESTAMPTZ; processed_count INTEGER:=0; updated_count INTEGER:=0; order_rec RECORD; BEGIN
  start_time := clock_timestamp();
  FOR order_rec IN (
    SELECT o.id FROM orders o
    WHERE EXISTS(SELECT 1 FROM payment_transactions pt WHERE pt.order_id=o.id AND pt.status IN ('success','paid'))
      AND o.payment_status!='paid' LIMIT p_limit
  ) LOOP
    processed_count := processed_count + 1; PERFORM public.reconcile_payment_status(order_rec.id); updated_count := updated_count + 1;
  END LOOP;
  end_time := clock_timestamp();
  INSERT INTO system_logs(event_type,data,created_at) VALUES (
    'batch_reconciliation', jsonb_build_object('orders_processed',processed_count,'orders_updated',updated_count,'processing_time_ms', EXTRACT(EPOCH FROM (end_time-start_time))*1000,'batch_limit',p_limit), NOW()
  );
  orders_processed := processed_count; orders_updated := updated_count; processing_time_ms := EXTRACT(EPOCH FROM (end_time-start_time))*1000; RETURN NEXT; END; $$ LANGUAGE plpgsql;

-- Grants (idempotent)
GRANT EXECUTE ON FUNCTION public.reconcile_payment_status(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_payment_system_health() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_order_payment_status(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.order_needs_reconciliation(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_payment_status_batch(INTEGER) TO service_role;