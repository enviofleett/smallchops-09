-- Ensure public_holidays table has proper structure and add some Nigerian holidays
-- First, check if table exists and add missing columns if needed

-- Ensure the table has all required columns
DO $$ 
BEGIN
    -- Add description column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'public_holidays' AND column_name = 'description') THEN
        ALTER TABLE public_holidays ADD COLUMN description TEXT;
    END IF;
    
    -- Add created_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'public_holidays' AND column_name = 'created_by') THEN
        ALTER TABLE public_holidays ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'public_holidays' AND column_name = 'updated_at') THEN
        ALTER TABLE public_holidays ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Add some default Nigerian holidays for 2024 if they don't exist
INSERT INTO public_holidays (name, date, description, is_active)
VALUES 
    ('New Year''s Day', '2024-01-01', 'Start of the new year', true),
    ('Good Friday', '2024-03-29', 'Christian holiday commemorating the crucifixion of Jesus', true),
    ('Easter Monday', '2024-04-01', 'Christian holiday following Easter Sunday', true),
    ('Workers'' Day', '2024-05-01', 'International Workers'' Day', true),
    ('Children''s Day', '2024-05-27', 'Day dedicated to children in Nigeria', true),
    ('Democracy Day', '2024-06-12', 'Celebrates Nigeria''s democratic government', true),
    ('Independence Day', '2024-10-01', 'Nigeria''s independence from British colonial rule', true),
    ('Christmas Day', '2024-12-25', 'Christian holiday celebrating the birth of Jesus', true),
    ('Boxing Day', '2024-12-26', 'Traditional holiday following Christmas Day', true)
ON CONFLICT (date) DO NOTHING;

-- Ensure business_settings table can store delivery scheduling config
-- Add delivery_scheduling_config column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'business_settings' AND column_name = 'delivery_scheduling_config') THEN
        ALTER TABLE business_settings ADD COLUMN delivery_scheduling_config JSONB DEFAULT '{}';
    END IF;
END $$;

-- Insert default delivery scheduling configuration if none exists
INSERT INTO business_settings (
    delivery_scheduling_config,
    business_hours,
    created_at,
    updated_at
)
SELECT 
    jsonb_build_object(
        'minimum_lead_time_minutes', 90,
        'max_advance_booking_days', 30,
        'default_delivery_duration_minutes', 120,
        'allow_same_day_delivery', true
    ),
    jsonb_build_object(
        'monday', jsonb_build_object('open', '09:00', 'close', '21:00', 'is_open', true),
        'tuesday', jsonb_build_object('open', '09:00', 'close', '21:00', 'is_open', true),
        'wednesday', jsonb_build_object('open', '09:00', 'close', '21:00', 'is_open', true),
        'thursday', jsonb_build_object('open', '09:00', 'close', '21:00', 'is_open', true),
        'friday', jsonb_build_object('open', '09:00', 'close', '21:00', 'is_open', true),
        'saturday', jsonb_build_object('open', '09:00', 'close', '21:00', 'is_open', true),
        'sunday', jsonb_build_object('open', '10:00', 'close', '20:00', 'is_open', true)
    ),
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM business_settings WHERE delivery_scheduling_config IS NOT NULL);

COMMENT ON COLUMN business_settings.delivery_scheduling_config IS 'Stores delivery scheduling configuration including lead times, booking limits, and policies';
COMMENT ON TABLE public_holidays IS 'Stores public holidays that affect delivery scheduling';