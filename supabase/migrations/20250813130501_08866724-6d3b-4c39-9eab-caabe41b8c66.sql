-- Create public holidays table (if not exists)
CREATE TABLE IF NOT EXISTS public.public_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create order delivery schedule table (if not exists)
CREATE TABLE IF NOT EXISTS public.order_delivery_schedule (
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

-- Enable RLS on new tables (only if they were just created)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'public_holidays') THEN
    ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Public can view active holidays" ON public.public_holidays
      FOR SELECT USING (is_active = true);

    CREATE POLICY "Admins can manage holidays" ON public.public_holidays
      FOR ALL USING (is_admin()) WITH CHECK (is_admin());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_delivery_schedule') THEN
    ALTER TABLE public.order_delivery_schedule ENABLE ROW LEVEL SECURITY;
    
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
  END IF;
END $$;

-- Create indexes for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public.public_holidays(date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_order_delivery_schedule_date ON public.order_delivery_schedule(delivery_date);
CREATE INDEX IF NOT EXISTS idx_order_delivery_schedule_order ON public.order_delivery_schedule(order_id);