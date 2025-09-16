
-- Align delivery scheduling to production rules and make DB the source of truth
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
      'Saturday',  jsonb_build_object('open','08:00','close','19:00','is_open', true),
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
