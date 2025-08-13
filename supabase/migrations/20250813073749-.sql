-- Fix validation function to allow proper transitions for data cleanup
CREATE OR REPLACE FUNCTION validate_order_update()
RETURNS TRIGGER AS $$
DECLARE
  allowed jsonb := '{
    "pending": ["confirmed","cancelled","refunded","failed"],
    "confirmed": ["preparing","cancelled","refunded"],
    "preparing": ["ready","cancelled"],
    "ready": ["out_for_delivery","delivered","cancelled"],
    "out_for_delivery": ["delivered","completed","cancelled"],
    "delivered": ["completed","refunded"],
    "completed": ["refunded"],
    "failed": ["pending","cancelled"]
  }';
  old_status text;
  new_status text;
BEGIN
  old_status := COALESCE(OLD.status::text, '');
  new_status := COALESCE(NEW.status::text, old_status);

  IF old_status IS DISTINCT FROM new_status THEN
    IF NOT (allowed ? old_status) OR NOT ((allowed->old_status) ? new_status) THEN
      RAISE EXCEPTION 'Invalid order status transition: % -> %', old_status, new_status;
    END IF;
  END IF;

  -- Only require rider assignment for active delivery statuses
  IF new_status IN ('out_for_delivery','delivered','completed') AND new_status != 'cancelled' THEN
    IF NEW.assigned_rider_id IS NULL THEN
      RAISE EXCEPTION 'A dispatch rider must be assigned before moving to %', new_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Now fix the problematic orders
UPDATE orders 
SET status = 'cancelled'
WHERE status = 'out_for_delivery' AND assigned_rider_id IS NULL;

-- Complete database consistency fixes
UPDATE orders 
SET 
    paystack_reference = payment_reference,
    updated_at = NOW()
WHERE 
    payment_reference IS NOT NULL 
    AND (paystack_reference IS NULL OR paystack_reference = '');

UPDATE payment_transactions pt
SET order_id = o.id
FROM orders o
WHERE pt.order_id IS NULL 
    AND pt.provider_reference = o.payment_reference;