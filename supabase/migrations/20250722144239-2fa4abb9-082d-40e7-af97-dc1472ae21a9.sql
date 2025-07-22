-- Phase 2: Business Operations Tables
-- 1. Delivery & Logistics System

-- Create vehicle type enum
CREATE TYPE public.vehicle_type AS ENUM ('bike', 'van', 'truck');

-- Create vehicle status enum
CREATE TYPE public.vehicle_status AS ENUM ('available', 'assigned', 'maintenance', 'inactive');

-- Create assignment status enum
CREATE TYPE public.assignment_status AS ENUM ('active', 'inactive');

-- Create vehicles table
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_plate TEXT UNIQUE NOT NULL,
  type public.vehicle_type NOT NULL,
  brand TEXT,
  model TEXT,
  status public.vehicle_status NOT NULL DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create vehicle assignments table
CREATE TABLE public.vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) NOT NULL,
  dispatch_rider_id UUID REFERENCES public.profiles(id) NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES public.profiles(id),
  status public.assignment_status NOT NULL DEFAULT 'active',
  notes TEXT
);

-- Create delivery zones table
CREATE TABLE public.delivery_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  area JSONB NOT NULL, -- GeoJSON Polygon coordinates
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create delivery fees table
CREATE TABLE public.delivery_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_id UUID NOT NULL REFERENCES public.delivery_zones(id) ON DELETE CASCADE,
  base_fee NUMERIC NOT NULL DEFAULT 0,
  fee_per_km NUMERIC,
  min_order_for_free_delivery NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add delivery zone reference to orders table
ALTER TABLE public.orders
ADD COLUMN delivery_zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL;

-- 2. Promotions & Marketing System

-- Create promotion type enum
CREATE TYPE public.promotion_type AS ENUM ('percentage', 'fixed_amount', 'buy_one_get_one', 'free_delivery');

-- Create promotion status enum
CREATE TYPE public.promotion_status AS ENUM ('active', 'inactive', 'expired', 'scheduled');

-- Create promotions table
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type public.promotion_type NOT NULL,
  value NUMERIC NOT NULL, -- Percentage or fixed amount
  min_order_amount NUMERIC DEFAULT 0,
  max_discount_amount NUMERIC,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  code TEXT UNIQUE,
  status public.promotion_status NOT NULL DEFAULT 'active',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  applicable_categories UUID[] DEFAULT '{}',
  applicable_products UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create promotion usage tracking table
CREATE TABLE public.promotion_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  discount_amount NUMERIC NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(promotion_id, order_id)
);

-- 3. Communication System

-- Create communication event status enum
CREATE TYPE public.communication_event_status AS ENUM ('queued', 'processing', 'sent', 'failed');

-- Create communication log status enum
CREATE TYPE public.communication_log_status AS ENUM ('sent', 'delivered', 'bounced', 'failed', 'skipped');

-- Create communication events table
CREATE TABLE public.communication_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- e.g., 'order_status_update'
  payload JSONB,
  status public.communication_event_status NOT NULL DEFAULT 'queued',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create communication logs table
CREATE TABLE public.communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.communication_events(id) ON DELETE SET NULL,
  order_id UUID NOT NULL,
  channel TEXT NOT NULL, -- 'email' or 'sms'
  recipient TEXT NOT NULL,
  status public.communication_log_status NOT NULL,
  template_name TEXT,
  subject TEXT, -- For emails
  provider_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create customer communication preferences table
CREATE TABLE public.customer_communication_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email TEXT NOT NULL UNIQUE,
  allow_order_updates BOOLEAN NOT NULL DEFAULT true,
  allow_promotions BOOLEAN NOT NULL DEFAULT true,
  preferred_channel TEXT NOT NULL DEFAULT 'any', -- 'email', 'sms', or 'any'
  language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add updated_at triggers for new tables
CREATE TRIGGER handle_updated_at_vehicles
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

CREATE TRIGGER handle_updated_at_delivery_zones
BEFORE UPDATE ON public.delivery_zones
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

CREATE TRIGGER handle_updated_at_delivery_fees
BEFORE UPDATE ON public.delivery_fees
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

CREATE TRIGGER handle_updated_at_promotions
BEFORE UPDATE ON public.promotions
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

CREATE TRIGGER handle_updated_at_communication_events
BEFORE UPDATE ON public.communication_events
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

CREATE TRIGGER handle_updated_at_customer_communication_preferences
BEFORE UPDATE ON public.customer_communication_preferences
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- Create trigger function for order status communication
CREATE OR REPLACE FUNCTION public.queue_order_status_change_communication()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert an event into the queue only when the order status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.communication_events (order_id, event_type, payload)
    VALUES (
      NEW.id,
      'order_status_update',
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'customer_name', NEW.customer_name,
        'customer_phone', NEW.customer_phone,
        'customer_email', NEW.customer_email
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for order status changes
CREATE TRIGGER on_order_status_update
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.queue_order_status_change_communication();

-- Enable RLS on new tables
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_communication_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicles
CREATE POLICY "Admins can manage vehicles"
ON public.vehicles FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for vehicle assignments
CREATE POLICY "Admins can manage vehicle assignments"
ON public.vehicle_assignments FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Riders can view their own assignments"
ON public.vehicle_assignments FOR SELECT
USING (dispatch_rider_id = auth.uid());

-- RLS Policies for delivery zones
CREATE POLICY "Admins can manage delivery zones"
ON public.delivery_zones FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated users can view delivery zones"
ON public.delivery_zones FOR SELECT
USING (auth.role() = 'authenticated');

-- RLS Policies for delivery fees
CREATE POLICY "Admins can manage delivery fees"
ON public.delivery_fees FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated users can view delivery fees"
ON public.delivery_fees FOR SELECT
USING (auth.role() = 'authenticated');

-- RLS Policies for promotions
CREATE POLICY "Admins can manage promotions"
ON public.promotions FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Staff can view active promotions"
ON public.promotions FOR SELECT
USING (status = 'active' AND public.get_user_role(auth.uid()) IN ('admin', 'manager', 'staff'));

-- RLS Policies for promotion usage
CREATE POLICY "Staff and above can view promotion usage"
ON public.promotion_usage FOR SELECT
USING (public.get_user_role(auth.uid()) IN ('admin', 'manager', 'staff'));

CREATE POLICY "Staff and above can insert promotion usage"
ON public.promotion_usage FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'manager', 'staff'));

-- RLS Policies for communication events
CREATE POLICY "Admins and managers can view communication events"
ON public.communication_events FOR SELECT
USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Service roles can manage communication events"
ON public.communication_events FOR ALL
USING (auth.role() = 'service_role');

-- RLS Policies for communication logs
CREATE POLICY "Admins and managers can view communication logs"
ON public.communication_logs FOR SELECT
USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Service roles can insert communication logs"
ON public.communication_logs FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- RLS Policies for customer communication preferences
CREATE POLICY "Admins and managers can view preferences"
ON public.customer_communication_preferences FOR SELECT
USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Service roles can manage preferences"
ON public.customer_communication_preferences FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create performance indexes
CREATE INDEX idx_vehicles_status ON public.vehicles(status);
CREATE INDEX idx_vehicle_assignments_rider ON public.vehicle_assignments(dispatch_rider_id);
CREATE INDEX idx_vehicle_assignments_vehicle ON public.vehicle_assignments(vehicle_id);
CREATE INDEX idx_delivery_zones_area ON public.delivery_zones USING GIN(area);
CREATE INDEX idx_promotions_code ON public.promotions(code);
CREATE INDEX idx_promotions_status ON public.promotions(status);
CREATE INDEX idx_promotions_valid_dates ON public.promotions(valid_from, valid_until);
CREATE INDEX idx_promotion_usage_promotion ON public.promotion_usage(promotion_id);
CREATE INDEX idx_communication_events_status ON public.communication_events(status);
CREATE INDEX idx_communication_events_order ON public.communication_events(order_id);
CREATE INDEX idx_communication_logs_event ON public.communication_logs(event_id);
CREATE INDEX idx_communication_logs_order ON public.communication_logs(order_id);
CREATE INDEX idx_communication_logs_status ON public.communication_logs(status);
CREATE INDEX idx_communication_logs_created_at ON public.communication_logs(created_at DESC);
CREATE INDEX idx_customer_comm_prefs_email ON public.customer_communication_preferences(customer_email);