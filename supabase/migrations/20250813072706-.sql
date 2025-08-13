-- Fix validation trigger that's preventing migration
-- Temporarily disable the trigger, then re-enable with proper logic

-- Drop and recreate the validation trigger with proper handling
DROP TRIGGER IF EXISTS validate_order_update_trigger ON orders;
DROP FUNCTION IF EXISTS validate_order_update();

-- Create updated validation function that handles 'failed' status
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

  -- Only require rider assignment for delivery statuses (skip for failed payments)
  IF new_status IN ('out_for_delivery','delivered','completed') AND new_status != 'failed' THEN
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

-- Now add 'failed' status to order_status enum if it doesn't exist
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