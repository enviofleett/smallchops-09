-- Create public holidays table
CREATE TABLE public.public_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create delivery time slots table
CREATE TABLE public.delivery_time_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_id UUID REFERENCES delivery_zones(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 1=Monday, etc.
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 10,
  current_bookings INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order delivery schedule table
CREATE TABLE public.order_delivery_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  delivery_date DATE NOT NULL,
  delivery_time_start TIME NOT NULL,
  delivery_time_end TIME NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_flexible BOOLEAN NOT NULL DEFAULT false,
  special_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Update business_settings table to include delivery scheduling configuration
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS delivery_scheduling_config JSONB DEFAULT jsonb_build_object(
  'minimum_lead_time_minutes', 90,
  'max_advance_booking_days', 30,
  'default_delivery_duration_minutes', 120,
  'allow_same_day_delivery', true,
  'business_hours', jsonb_build_object(
    'monday', jsonb_build_object('open', '09:00', 'close', '21:00', 'is_open', true),
    'tuesday', jsonb_build_object('open', '09:00', 'close', '21:00', 'is_open', true),
    'wednesday', jsonb_build_object('open', '09:00', 'close', '21:00', 'is_open', true),
    'thursday', jsonb_build_object('open', '09:00', 'close', '21:00', 'is_open', true),
    'friday', jsonb_build_object('open', '09:00', 'close', '21:00', 'is_open', true),
    'saturday', jsonb_build_object('open', '09:00', 'close', '21:00', 'is_open', true),
    'sunday', jsonb_build_object('open', '10:00', 'close', '20:00', 'is_open', true)
  )
);

-- Enable RLS on new tables
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_delivery_schedule ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public_holidays
CREATE POLICY "Public can view active holidays" ON public.public_holidays
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage holidays" ON public.public_holidays
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Create RLS policies for delivery_time_slots
CREATE POLICY "Public can view active time slots" ON public.delivery_time_slots
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage time slots" ON public.delivery_time_slots
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Create RLS policies for order_delivery_schedule
CREATE POLICY "Customers can view their delivery schedules" ON public.order_delivery_schedule
  FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM orders o 
      WHERE (
        (o.customer_id IS NOT NULL AND o.customer_id IN (
          SELECT ca.id FROM customer_accounts ca WHERE ca.user_id = auth.uid()
        )) OR 
        (o.customer_email IS NOT NULL AND LOWER(o.customer_email) = current_user_email())
      )
    )
  );

CREATE POLICY "Customers can create delivery schedules during checkout" ON public.order_delivery_schedule
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT o.id FROM orders o 
      WHERE o.customer_email IN (
        SELECT users.email FROM auth.users WHERE users.id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage all delivery schedules" ON public.order_delivery_schedule
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Service roles can manage delivery schedules" ON public.order_delivery_schedule
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX idx_public_holidays_date ON public.public_holidays(date) WHERE is_active = true;
CREATE INDEX idx_delivery_time_slots_day_zone ON public.delivery_time_slots(day_of_week, zone_id) WHERE is_active = true;
CREATE INDEX idx_order_delivery_schedule_date ON public.order_delivery_schedule(delivery_date);
CREATE INDEX idx_order_delivery_schedule_order ON public.order_delivery_schedule(order_id);