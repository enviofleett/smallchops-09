-- Fix trigger to avoid invalid enum value 'processing'
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
  IF NEW.status NOT IN ('success','paid') THEN
    RETURN NEW;
  END IF;

  IF NEW.order_id IS NULL THEN
    IF NEW.metadata ? 'order_id' AND NEW.metadata->>'order_id' ~* '^[0-9a-f-]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT id INTO v_order_id FROM orders WHERE id = (NEW.metadata->>'order_id')::uuid;
    END IF;

    IF v_order_id IS NULL AND NEW.provider_reference IS NOT NULL THEN
      SELECT id INTO v_order_id FROM orders WHERE payment_reference = NEW.provider_reference;
    END IF;

    IF v_order_id IS NULL AND NEW.metadata ? 'order_number' THEN
      v_order_number := NEW.metadata->>'order_number';
      SELECT id INTO v_order_id FROM orders WHERE order_number = v_order_number;
    END IF;

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
          WHEN status IN ('pending','confirmed','preparing') THEN 'confirmed'
          ELSE status
        END,
        updated_at = now()
      WHERE id = v_order_id;
    END IF;
  ELSE
    UPDATE orders
    SET 
      payment_status = 'paid',
      paid_at = COALESCE(orders.paid_at, NEW.paid_at, now()),
      status = CASE 
        WHEN status IN ('pending','confirmed','preparing') THEN 'confirmed'
        ELSE status
      END,
      updated_at = now()
    WHERE id = NEW.order_id
      AND (orders.payment_status IS DISTINCT FROM 'paid' OR orders.paid_at IS NULL);
  END IF;

  RETURN NEW;
END;
$$;

-- Rerun backfill with valid statuses only
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

UPDATE public.orders o
SET 
  payment_status = 'paid',
  paid_at = COALESCE(o.paid_at, t.paid_at, now()),
  status = CASE 
    WHEN o.status IN ('pending','confirmed','preparing') THEN 'confirmed'
    ELSE o.status
  END,
  updated_at = now()
FROM public.payment_transactions t
WHERE t.order_id = o.id
  AND t.status IN ('success','paid')
  AND (o.payment_status IS DISTINCT FROM 'paid' OR o.paid_at IS NULL);