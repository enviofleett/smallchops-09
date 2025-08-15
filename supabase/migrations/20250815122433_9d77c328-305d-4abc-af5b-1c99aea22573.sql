-- Critical Production Fixes for Delivery Zone System

-- First, add missing columns to delivery zones if needed
ALTER TABLE delivery_zones 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add database constraints for delivery fees
ALTER TABLE delivery_fees 
ADD CONSTRAINT IF NOT EXISTS check_base_fee_non_negative CHECK (base_fee >= 0),
ADD CONSTRAINT IF NOT EXISTS check_fee_per_km_non_negative CHECK (fee_per_km IS NULL OR fee_per_km >= 0),
ADD CONSTRAINT IF NOT EXISTS check_min_order_non_negative CHECK (min_order_for_free_delivery IS NULL OR min_order_for_free_delivery >= 0);

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

CREATE TRIGGER validate_order_delivery_zone_trigger
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION validate_order_delivery_zone();

-- Add function to calculate accurate delivery fees with distance support
CREATE OR REPLACE FUNCTION calculate_delivery_fee_with_distance(
  p_zone_id UUID,
  p_distance_km NUMERIC DEFAULT NULL,
  p_order_subtotal NUMERIC DEFAULT 0
) RETURNS NUMERIC AS $$
DECLARE
  v_fee_record RECORD;
  v_total_fee NUMERIC := 0;
BEGIN
  -- Get fee structure for the zone
  SELECT base_fee, fee_per_km, min_order_for_free_delivery
  INTO v_fee_record
  FROM delivery_fees
  WHERE zone_id = p_zone_id;
  
  IF NOT FOUND THEN
    RETURN 0; -- No fee structure found
  END IF;
  
  -- Check for free delivery threshold
  IF v_fee_record.min_order_for_free_delivery IS NOT NULL 
     AND p_order_subtotal >= v_fee_record.min_order_for_free_delivery THEN
    RETURN 0;
  END IF;
  
  -- Calculate base fee
  v_total_fee := COALESCE(v_fee_record.base_fee, 0);
  
  -- Add distance-based fee if provided
  IF p_distance_km IS NOT NULL AND v_fee_record.fee_per_km IS NOT NULL THEN
    v_total_fee := v_total_fee + (p_distance_km * v_fee_record.fee_per_km);
  END IF;
  
  RETURN v_total_fee;
END;
$$ LANGUAGE plpgsql;