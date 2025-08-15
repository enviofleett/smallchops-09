-- Critical Production Fixes for Delivery Zone System

-- First, add missing columns to delivery zones if needed
ALTER TABLE delivery_zones 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add database constraints for delivery fees (correct syntax)
DO $$ 
BEGIN
  -- Check if constraints don't exist before adding them
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_base_fee_non_negative' 
    AND table_name = 'delivery_fees'
  ) THEN
    ALTER TABLE delivery_fees ADD CONSTRAINT check_base_fee_non_negative CHECK (base_fee >= 0);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_fee_per_km_non_negative' 
    AND table_name = 'delivery_fees'
  ) THEN
    ALTER TABLE delivery_fees ADD CONSTRAINT check_fee_per_km_non_negative CHECK (fee_per_km IS NULL OR fee_per_km >= 0);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_min_order_non_negative' 
    AND table_name = 'delivery_fees'
  ) THEN
    ALTER TABLE delivery_fees ADD CONSTRAINT check_min_order_non_negative CHECK (min_order_for_free_delivery IS NULL OR min_order_for_free_delivery >= 0);
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_delivery_fees_zone_id ON delivery_fees(zone_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_zone ON orders(delivery_zone_id) WHERE delivery_zone_id IS NOT NULL;

-- Add trigger to validate zone assignment in orders
CREATE OR REPLACE FUNCTION validate_order_delivery_zone()
RETURNS TRIGGER AS $$
BEGIN
  -- If delivery_zone_id is provided, ensure the zone exists and is active
  IF NEW.delivery_zone_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM delivery_zones 
      WHERE id = NEW.delivery_zone_id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Invalid or inactive delivery zone: %', NEW.delivery_zone_id;
    END IF;
  END IF;
  
  -- Ensure delivery orders have a delivery zone
  IF NEW.order_type = 'delivery' AND NEW.delivery_zone_id IS NULL THEN
    RAISE EXCEPTION 'Delivery orders must specify a delivery zone';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_order_delivery_zone_trigger ON orders;
CREATE TRIGGER validate_order_delivery_zone_trigger
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION validate_order_delivery_zone();