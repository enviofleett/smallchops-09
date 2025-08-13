-- Check if delivery_routes table exists and create if missing
CREATE TABLE IF NOT EXISTS public.delivery_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID REFERENCES public.drivers(id),
  route_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  total_orders INTEGER DEFAULT 0,
  total_distance NUMERIC,
  estimated_duration INTEGER, -- in minutes
  actual_duration INTEGER, -- in minutes
  route_points JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Check if route_order_assignments table exists and create if missing
CREATE TABLE IF NOT EXISTS public.route_order_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID REFERENCES public.delivery_routes(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  estimated_arrival TIMESTAMP WITH TIME ZONE,
  actual_arrival TIMESTAMP WITH TIME ZONE,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'en_route', 'delivered', 'failed')),
  delivery_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.delivery_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_order_assignments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage delivery routes" ON public.delivery_routes
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Drivers can view their routes" ON public.delivery_routes
  FOR SELECT USING (driver_id IN (
    SELECT id FROM drivers WHERE profile_id = auth.uid()
  ));

CREATE POLICY "Admins can manage route assignments" ON public.route_order_assignments
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Drivers can view their route assignments" ON public.route_order_assignments
  FOR SELECT USING (route_id IN (
    SELECT id FROM delivery_routes WHERE driver_id IN (
      SELECT id FROM drivers WHERE profile_id = auth.uid()
    )
  ));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_delivery_routes_date ON public.delivery_routes(route_date);
CREATE INDEX IF NOT EXISTS idx_delivery_routes_driver ON public.delivery_routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_route_assignments_route ON public.route_order_assignments(route_id);
CREATE INDEX IF NOT EXISTS idx_route_assignments_order ON public.route_order_assignments(order_id);

-- Create triggers for updated_at timestamp
CREATE OR REPLACE FUNCTION update_delivery_routes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_delivery_routes_updated_at
  BEFORE UPDATE ON public.delivery_routes
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_routes_timestamp();