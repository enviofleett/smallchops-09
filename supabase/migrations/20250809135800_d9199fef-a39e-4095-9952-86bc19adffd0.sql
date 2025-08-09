-- 1) Helpful indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference 
  ON public.orders (payment_reference);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_reference 
  ON public.payment_transactions (provider_reference);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id 
  ON public.payment_transactions (order_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_status_order 
  ON public.payment_transactions (status, order_id);

-- 2) Trigger to backfill order linkage and update order payment status
CREATE OR REPLACE FUNCTION public.backfill_order_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
BEGIN
  -- Only act on successful/paid transactions
  IF NEW.status NOT IN ('success','paid') THEN
    RETURN NEW;
  END IF;

  -- Try to resolve order_id if missing
  IF NEW.order_id IS NULL THEN
    -- 1) From metadata.order_id
    IF NEW.metadata ? 'order_id' AND NEW.metadata->>'order_id' ~* '^[0-9a-f-]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT id INTO v_order_id FROM orders WHERE id = (NEW.metadata->>'order_id')::uuid;
    END IF;

    -- 2) From provider_reference -> orders.payment_reference
    IF v_order_id IS NULL AND NEW.provider_reference IS NOT NULL THEN
      SELECT id INTO v_order_id FROM orders WHERE payment_reference = NEW.provider_reference;
    END IF;

    -- 3) From metadata.order_number -> orders.order_number
    IF v_order_id IS NULL AND NEW.metadata ? 'order_number' THEN
      v_order_number := NEW.metadata->>'order_number';
      SELECT id INTO v_order_id FROM orders WHERE order_number = v_order_number;
    END IF;

    -- If found, attach transaction to order and update order status
    IF v_order_id IS NOT NULL THEN
      UPDATE payment_transactions
      SET order_id = v_order_id,
          updated_at = now()
      WHERE id = NEW.id;

      UPDATE orders
      SET 
        payment_status = 'paid',
        paid_at = COALESCE(orders.paid_at, NEW.paid_at, now()),
        status = CASE 
          WHEN status IN ('pending','processing','confirmed','preparing') THEN 'confirmed'
          ELSE status
        END,
        updated_at = now()
      WHERE id = v_order_id;
    END IF;
  ELSE
    -- If order_id present, ensure order is marked paid
    UPDATE orders
    SET 
      payment_status = 'paid',
      paid_at = COALESCE(orders.paid_at, NEW.paid_at, now()),
      status = CASE 
        WHEN status IN ('pending','processing','confirmed','preparing') THEN 'confirmed'
        ELSE status
      END,
      updated_at = now()
    WHERE id = NEW.order_id
      AND (orders.payment_status IS DISTINCT FROM 'paid' OR orders.paid_at IS NULL);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_backfill_order_on_payment ON public.payment_transactions;
CREATE TRIGGER trg_backfill_order_on_payment
AFTER INSERT OR UPDATE ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.backfill_order_on_payment();

-- 3) Consolidated view for easy consumption by UI/admin
CREATE OR REPLACE VIEW public.orders_with_payment AS
SELECT 
  o.*,
  pt.status AS payment_tx_status,
  pt.paid_at AS payment_tx_paid_at,
  pt.provider_reference AS payment_tx_provider_reference
FROM public.orders o
LEFT JOIN LATERAL (
  SELECT t.status, t.paid_at, t.provider_reference
  FROM public.payment_transactions t
  WHERE t.order_id = o.id
  ORDER BY t.paid_at DESC NULLS LAST, t.created_at DESC
  LIMIT 1
) pt ON TRUE;