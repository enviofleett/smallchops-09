-- Add business_hours column to business_settings table for delivery scheduling
ALTER TABLE business_settings 
ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
  "monday": {"open": "09:00", "close": "21:00", "is_open": true},
  "tuesday": {"open": "09:00", "close": "21:00", "is_open": true},
  "wednesday": {"open": "09:00", "close": "21:00", "is_open": true},
  "thursday": {"open": "09:00", "close": "21:00", "is_open": true},
  "friday": {"open": "09:00", "close": "21:00", "is_open": true},
  "saturday": {"open": "09:00", "close": "21:00", "is_open": true},
  "sunday": {"open": "10:00", "close": "20:00", "is_open": true}
}'::jsonb;

-- Update the delivery_scheduling_config to include business hours if it doesn't exist
UPDATE business_settings 
SET delivery_scheduling_config = COALESCE(delivery_scheduling_config, '{}'::jsonb) || jsonb_build_object(
  'minimum_lead_time_minutes', 90,
  'max_advance_booking_days', 30,
  'default_delivery_duration_minutes', 120,
  'allow_same_day_delivery', true,
  'business_hours', business_hours
)
WHERE delivery_scheduling_config IS NULL OR NOT (delivery_scheduling_config ? 'business_hours');

-- Comment on the business_hours column
COMMENT ON COLUMN business_settings.business_hours IS 'Store operating hours for each day of the week, used for delivery scheduling';