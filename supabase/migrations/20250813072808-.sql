-- Fix trigger dependency by dropping with CASCADE
DROP FUNCTION IF EXISTS validate_order_update() CASCADE;

-- Create updated validation function that handles 'failed' status properly
CREATE OR REPLACE FUNCTION validate_order_update()
RETURNS TRIGGER AS $$
DECLARE
  allowed jsonb := '{
    "pending": ["confirmed","cancelled","refunded","failed"],
    "confirmed": ["preparing","cancelled","refunded"],
    "preparing": ["ready","cancelled"],
    "ready": ["out_for_delivery","delivered"],
    "out_for_delivery": ["delivered","completed"],
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

  -- Only require rider assignment for delivery statuses (not for failed payments)
  IF new_status IN ('out_for_delivery','delivered','completed') THEN
    IF NEW.assigned_rider_id IS NULL THEN
      RAISE EXCEPTION 'A dispatch rider must be assigned before moving to %', new_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER validate_order_update_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_update();

-- Add 'failed' status to order_status enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'failed' 
        AND enumtypid = 'order_status'::regtype
    ) THEN
        ALTER TYPE order_status ADD VALUE 'failed';
    END IF;
END $$;

-- Phase 3: Database consistency fix - backfill missing paystack_reference values
UPDATE orders 
SET 
    paystack_reference = payment_reference,
    updated_at = NOW()
WHERE 
    payment_reference IS NOT NULL 
    AND (paystack_reference IS NULL OR paystack_reference = '');

-- Ensure payment_transactions are properly linked to orders
UPDATE payment_transactions pt
SET order_id = o.id
FROM orders o
WHERE pt.order_id IS NULL 
    AND pt.provider_reference = o.payment_reference;

-- Create index for better payment verification performance
CREATE INDEX IF NOT EXISTS idx_orders_payment_references 
ON orders (payment_reference, paystack_reference) 
WHERE payment_reference IS NOT NULL;