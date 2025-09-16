-- Phase 1: Database Simplification
-- Remove legacy promotion tables that add unnecessary complexity
DROP TABLE IF EXISTS promotion_usage_audit CASCADE;
DROP TABLE IF EXISTS promotion_analytics CASCADE; 
DROP TABLE IF EXISTS promotion_code_rate_limits CASCADE;
DROP TABLE IF EXISTS promotion_security_audit CASCADE;
DROP TABLE IF EXISTS bogo_allocations CASCADE;

-- Simplify promotions table to production-ready essentials
-- Remove complex fields that won't be used in simplified system
ALTER TABLE promotions DROP COLUMN IF EXISTS applicable_products;
ALTER TABLE promotions DROP COLUMN IF EXISTS applicable_categories; 
ALTER TABLE promotions DROP COLUMN IF EXISTS applicable_days;
ALTER TABLE promotions DROP COLUMN IF EXISTS usage_limit;
ALTER TABLE promotions DROP COLUMN IF EXISTS usage_count;
ALTER TABLE promotions DROP COLUMN IF EXISTS max_discount_amount;

-- Update promotion_type enum to only include essential types
ALTER TYPE promotion_type RENAME TO promotion_type_old;
CREATE TYPE promotion_type AS ENUM ('percentage', 'fixed_amount', 'free_delivery');

-- Update promotions table to use new simplified enum
ALTER TABLE promotions ALTER COLUMN type TYPE promotion_type USING 
  CASE 
    WHEN type::text = 'percentage' THEN 'percentage'::promotion_type
    WHEN type::text = 'fixed_amount' THEN 'fixed_amount'::promotion_type
    WHEN type::text = 'free_delivery' THEN 'free_delivery'::promotion_type
    ELSE 'percentage'::promotion_type  -- default fallback
  END;

-- Clean up old enum
DROP TYPE promotion_type_old;

-- Ensure essential fields have proper defaults
ALTER TABLE promotions ALTER COLUMN min_order_amount SET DEFAULT 0;
ALTER TABLE promotions ALTER COLUMN status SET DEFAULT 'active';

-- Update validation trigger to work with simplified structure
CREATE OR REPLACE FUNCTION validate_simplified_promotion_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure value is provided for percentage and fixed_amount promotions
  IF NEW.type IN ('percentage', 'fixed_amount') AND NEW.value IS NULL THEN
    RAISE EXCEPTION 'Value is required for % promotions', NEW.type;
  END IF;
  
  -- For free_delivery, value should be null
  IF NEW.type = 'free_delivery' THEN
    NEW.value := NULL;
  END IF;
  
  -- Ensure value is not negative
  IF NEW.value IS NOT NULL AND NEW.value < 0 THEN
    RAISE EXCEPTION 'Promotion value cannot be negative';
  END IF;
  
  -- Ensure percentage promotions are between 1 and 100
  IF NEW.type = 'percentage' AND NEW.value IS NOT NULL AND (NEW.value <= 0 OR NEW.value > 100) THEN
    RAISE EXCEPTION 'Percentage discount must be between 1 and 100';
  END IF;
  
  -- Ensure min_order_amount is not negative
  IF NEW.min_order_amount IS NOT NULL AND NEW.min_order_amount < 0 THEN
    RAISE EXCEPTION 'Minimum order amount cannot be negative';
  END IF;
  
  -- Ensure valid_until is after valid_from
  IF NEW.valid_until IS NOT NULL AND NEW.valid_until <= NEW.valid_from THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace old validation trigger
DROP TRIGGER IF EXISTS validate_promotion_data_trigger ON promotions;
CREATE TRIGGER validate_simplified_promotion_data_trigger
  BEFORE INSERT OR UPDATE ON promotions
  FOR EACH ROW EXECUTE FUNCTION validate_simplified_promotion_data();

-- Add performance indexes for simplified queries
CREATE INDEX IF NOT EXISTS idx_promotions_active_dates 
  ON promotions (status, valid_from, valid_until) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_promotions_type_active 
  ON promotions (type, status) 
  WHERE status = 'active';