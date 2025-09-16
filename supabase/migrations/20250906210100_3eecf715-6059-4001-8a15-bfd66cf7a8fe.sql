-- Update delivery scheduling config with production-ready settings
UPDATE business_settings 
SET 
  delivery_scheduling_config = delivery_scheduling_config || jsonb_build_object(
    'minimum_lead_time_minutes', 60,
    'max_advance_booking_days', 60, 
    'default_delivery_duration_minutes', 60
  ),
  updated_at = now()
WHERE name = 'Starters Small Chops';