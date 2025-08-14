-- Create delivery time slots table with hourly slots (8 AM - 6 PM)
-- Maximum 20 orders per slot with real-time capacity tracking

-- Create enhanced delivery_time_slots table
DROP TABLE IF EXISTS delivery_time_slots CASCADE;

CREATE TABLE delivery_time_slots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  max_capacity integer NOT NULL DEFAULT 20,
  current_bookings integer NOT NULL DEFAULT 0,
  is_available boolean GENERATED ALWAYS AS (current_bookings < max_capacity) STORED,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Ensure unique time slots per date
  UNIQUE(date, start_time, end_time)
);

-- Enable RLS
ALTER TABLE delivery_time_slots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public can view available delivery slots" 
ON delivery_time_slots FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage delivery slots" 
ON delivery_time_slots FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

-- Function to populate hourly delivery slots for working days
CREATE OR REPLACE FUNCTION populate_delivery_slots(
  start_date date,
  end_date date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  curr_date date;
  business_hrs jsonb;
  day_name text;
  is_working_day boolean;
  slot_time time;
BEGIN
  -- Get business hours configuration
  SELECT business_hours INTO business_hrs
  FROM business_settings
  LIMIT 1;
  
  -- Default business hours if not configured
  IF business_hrs IS NULL THEN
    business_hrs := '{
      "monday": {"open": "08:00", "close": "18:00", "is_open": true},
      "tuesday": {"open": "08:00", "close": "18:00", "is_open": true},
      "wednesday": {"open": "08:00", "close": "18:00", "is_open": true},
      "thursday": {"open": "08:00", "close": "18:00", "is_open": true},
      "friday": {"open": "08:00", "close": "18:00", "is_open": true},
      "saturday": {"open": "08:00", "close": "18:00", "is_open": true},
      "sunday": {"open": "10:00", "close": "18:00", "is_open": false}
    }'::jsonb;
  END IF;
  
  curr_date := start_date;
  
  WHILE curr_date <= end_date LOOP
    -- Get day name
    day_name := LOWER(to_char(curr_date, 'Day'));
    day_name := TRIM(day_name);
    
    -- Check if it's a working day
    is_working_day := (business_hrs->day_name->>'is_open')::boolean;
    
    -- Skip holidays
    IF EXISTS (
      SELECT 1 FROM public_holidays 
      WHERE date = curr_date AND is_active = true
    ) THEN
      is_working_day := false;
    END IF;
    
    -- Create hourly slots for working days (8 AM - 6 PM)
    IF is_working_day THEN
      slot_time := '08:00'::time;
      
      WHILE slot_time < '18:00'::time LOOP
        INSERT INTO delivery_time_slots (
          date, 
          start_time, 
          end_time, 
          max_capacity,
          current_bookings
        ) VALUES (
          curr_date,
          slot_time,
          slot_time + interval '1 hour',
          20,
          0
        )
        ON CONFLICT (date, start_time, end_time) 
        DO NOTHING;
        
        slot_time := slot_time + interval '1 hour';
      END LOOP;
    END IF;
    
    curr_date := curr_date + interval '1 day';
  END LOOP;
END;
$$;

-- Function to get available slots with capacity
CREATE OR REPLACE FUNCTION get_available_delivery_slots(
  p_start_date date DEFAULT CURRENT_DATE,
  p_end_date date DEFAULT CURRENT_DATE + interval '30 days'
) RETURNS TABLE (
  slot_id uuid,
  date date,
  start_time time,
  end_time time,
  max_capacity integer,
  current_bookings integer,
  available_spots integer,
  is_available boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    id as slot_id,
    dts.date,
    dts.start_time,
    dts.end_time,
    dts.max_capacity,
    dts.current_bookings,
    (dts.max_capacity - dts.current_bookings) as available_spots,
    dts.is_available
  FROM delivery_time_slots dts
  WHERE dts.date BETWEEN p_start_date AND p_end_date
    AND dts.is_available = true
    AND dts.date >= CURRENT_DATE
  ORDER BY dts.date, dts.start_time;
$$;

-- Function to reserve a delivery slot
CREATE OR REPLACE FUNCTION reserve_delivery_slot(
  p_slot_id uuid,
  p_order_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot RECORD;
  v_result jsonb;
BEGIN
  -- Get slot details with row lock
  SELECT * INTO v_slot
  FROM delivery_time_slots
  WHERE id = p_slot_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Delivery slot not found'
    );
  END IF;
  
  -- Check if slot is still available
  IF v_slot.current_bookings >= v_slot.max_capacity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Delivery slot is fully booked'
    );
  END IF;
  
  -- Reserve the slot
  UPDATE delivery_time_slots
  SET current_bookings = current_bookings + 1,
      updated_at = now()
  WHERE id = p_slot_id;
  
  -- Log the reservation if order_id provided
  IF p_order_id IS NOT NULL THEN
    INSERT INTO audit_logs (
      action, category, message, entity_id, new_values
    ) VALUES (
      'delivery_slot_reserved',
      'Delivery Management',
      'Delivery slot reserved for order',
      p_order_id,
      jsonb_build_object(
        'slot_id', p_slot_id,
        'date', v_slot.date,
        'start_time', v_slot.start_time,
        'end_time', v_slot.end_time
      )
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Slot reserved successfully',
    'slot_id', p_slot_id,
    'remaining_spots', v_slot.max_capacity - v_slot.current_bookings - 1
  );
END;
$$;

-- Function to release a delivery slot
CREATE OR REPLACE FUNCTION release_delivery_slot(
  p_slot_id uuid,
  p_order_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot RECORD;
BEGIN
  -- Get slot details with row lock
  SELECT * INTO v_slot
  FROM delivery_time_slots
  WHERE id = p_slot_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Delivery slot not found'
    );
  END IF;
  
  -- Release the slot (ensure current_bookings doesn't go below 0)
  UPDATE delivery_time_slots
  SET current_bookings = GREATEST(0, current_bookings - 1),
      updated_at = now()
  WHERE id = p_slot_id;
  
  -- Log the release if order_id provided
  IF p_order_id IS NOT NULL THEN
    INSERT INTO audit_logs (
      action, category, message, entity_id, new_values
    ) VALUES (
      'delivery_slot_released',
      'Delivery Management',
      'Delivery slot released for order',
      p_order_id,
      jsonb_build_object(
        'slot_id', p_slot_id,
        'date', v_slot.date,
        'start_time', v_slot.start_time,
        'end_time', v_slot.end_time
      )
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Slot released successfully',
    'slot_id', p_slot_id,
    'new_available_spots', v_slot.max_capacity - v_slot.current_bookings + 1
  );
END;
$$;

-- Trigger to update delivery slot bookings when orders are placed/cancelled
CREATE OR REPLACE FUNCTION update_delivery_slot_bookings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot_id uuid;
BEGIN
  -- Handle order_delivery_schedule changes
  IF TG_TABLE_NAME = 'order_delivery_schedule' THEN
    IF TG_OP = 'INSERT' THEN
      -- Find matching slot and reserve it
      SELECT id INTO v_slot_id
      FROM delivery_time_slots
      WHERE date = NEW.delivery_date::date
        AND start_time = NEW.delivery_time_start::time
        AND end_time = NEW.delivery_time_end::time;
      
      IF v_slot_id IS NOT NULL THEN
        PERFORM reserve_delivery_slot(v_slot_id, NEW.order_id);
      END IF;
      
    ELSIF TG_OP = 'DELETE' THEN
      -- Find matching slot and release it
      SELECT id INTO v_slot_id
      FROM delivery_time_slots
      WHERE date = OLD.delivery_date::date
        AND start_time = OLD.delivery_time_start::time
        AND end_time = OLD.delivery_time_end::time;
      
      IF v_slot_id IS NOT NULL THEN
        PERFORM release_delivery_slot(v_slot_id, OLD.order_id);
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS update_delivery_slot_bookings_trigger ON order_delivery_schedule;
CREATE TRIGGER update_delivery_slot_bookings_trigger
  AFTER INSERT OR DELETE ON order_delivery_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_slot_bookings();

-- Populate initial slots for next 60 days
SELECT populate_delivery_slots(
  CURRENT_DATE,
  CURRENT_DATE + interval '60 days'
);

-- Enable realtime for delivery_time_slots
ALTER TABLE delivery_time_slots REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_time_slots;