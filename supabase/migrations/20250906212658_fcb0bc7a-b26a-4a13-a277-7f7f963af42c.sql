-- Fix the validation function to remove invalid email check
CREATE OR REPLACE FUNCTION public.validate_business_settings()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate required fields
  IF NEW.name IS NULL OR trim(NEW.name) = '' THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;
  
  -- Validate business_hours JSON if provided
  IF NEW.business_hours IS NOT NULL THEN
    BEGIN
      PERFORM NEW.business_hours::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid JSON format for business_hours';
    END;
  END IF;
  
  -- Validate delivery_scheduling_config JSON if provided
  IF NEW.delivery_scheduling_config IS NOT NULL THEN
    BEGIN
      PERFORM NEW.delivery_scheduling_config::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid JSON format for delivery_scheduling_config';
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Now update the business_settings with correct delivery configuration
UPDATE public.business_settings
SET 
  delivery_scheduling_config = jsonb_build_object(
    'minimum_lead_time_minutes', 60,
    'max_advance_booking_days', 60,
    'default_delivery_duration_minutes', 60,
    'allow_same_day_delivery', true,
    'business_hours', jsonb_build_object(
      'monday',    jsonb_build_object('open','08:00','close','19:00','is_open', true),
      'tuesday',   jsonb_build_object('open','08:00','close','19:00','is_open', true),
      'wednesday', jsonb_build_object('open','08:00','close','19:00','is_open', true),
      'thursday',  jsonb_build_object('open','08:00','close','19:00','is_open', true),
      'friday',    jsonb_build_object('open','08:00','close','19:00','is_open', true),
      'saturday',  jsonb_build_object('open','08:00','close','19:00','is_open', true),
      'sunday',    jsonb_build_object('open','10:00','close','16:00','is_open', true)
    )
  ),
  business_hours = jsonb_build_object(
    'monday',    jsonb_build_object('open','08:00','close','19:00','is_open', true),
    'tuesday',   jsonb_build_object('open','08:00','close','19:00','is_open', true),
    'wednesday', jsonb_build_object('open','08:00','close','19:00','is_open', true),
    'thursday',  jsonb_build_object('open','08:00','close','19:00','is_open', true),
    'friday',    jsonb_build_object('open','08:00','close','19:00','is_open', true),
    'saturday',  jsonb_build_object('open','08:00','close','19:00','is_open', true),
    'sunday',    jsonb_build_object('open','10:00','close','16:00','is_open', true)
  ),
  updated_at = now();