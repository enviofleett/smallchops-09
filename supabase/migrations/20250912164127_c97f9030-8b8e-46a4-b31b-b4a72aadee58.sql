-- Make promotions table production-ready for the new simplified system
-- Update the value column to be nullable for free_delivery promotions
ALTER TABLE public.promotions 
ALTER COLUMN value DROP NOT NULL;

-- Add a comment to document the table structure
COMMENT ON TABLE public.promotions IS 'Production-ready promotions system supporting percentage, fixed amount, and free delivery promotions';

-- Ensure indexes for performance
CREATE INDEX IF NOT EXISTS idx_promotions_active_dates 
ON public.promotions(status, valid_from, valid_until) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_promotions_type_active 
ON public.promotions(type, status) 
WHERE status = 'active';

-- Add validation trigger for business rules
CREATE OR REPLACE FUNCTION validate_promotion_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure value is provided for non-free_delivery promotions
  IF NEW.type != 'free_delivery' AND NEW.value IS NULL THEN
    RAISE EXCEPTION 'Value is required for % promotions', NEW.type;
  END IF;
  
  -- Ensure value is not negative
  IF NEW.value IS NOT NULL AND NEW.value < 0 THEN
    RAISE EXCEPTION 'Promotion value cannot be negative';
  END IF;
  
  -- Ensure percentage promotions are between 0 and 100
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

-- Apply the validation trigger
DROP TRIGGER IF EXISTS validate_promotion_trigger ON public.promotions;
CREATE TRIGGER validate_promotion_trigger
  BEFORE INSERT OR UPDATE ON public.promotions
  FOR EACH ROW
  EXECUTE FUNCTION validate_promotion_data();

-- Clean up any invalid existing data (make value NULL for free_delivery)
UPDATE public.promotions 
SET value = NULL 
WHERE type = 'free_delivery' AND value IS NOT NULL;