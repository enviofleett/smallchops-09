-- Add column to store explicitly disabled calendar dates for ordering
ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS disabled_calendar_dates jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.business_settings.disabled_calendar_dates IS 'JSON array of specific dates (YYYY-MM-DD format) explicitly disabled for deliveries/pickups by admin.';