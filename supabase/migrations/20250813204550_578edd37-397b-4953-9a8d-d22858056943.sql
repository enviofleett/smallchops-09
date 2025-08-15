-- Fix database schema issues for admin pages

-- Create proper RLS policies for drivers table
DROP POLICY IF EXISTS "Admins can manage drivers" ON public.drivers;
CREATE POLICY "Admins can manage drivers" ON public.drivers
FOR ALL USING (is_admin())
WITH CHECK (is_admin());

-- Create proper RLS policies for route_order_assignments
DROP POLICY IF EXISTS "Admins can manage route assignments" ON public.route_order_assignments;
CREATE POLICY "Admins can manage route assignments" ON public.route_order_assignments
FOR ALL USING (is_admin())
WITH CHECK (is_admin());

-- Enable RLS on tables
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_order_assignments ENABLE ROW LEVEL SECURITY;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_delivery_routes_date ON public.delivery_routes(route_date);
CREATE INDEX IF NOT EXISTS idx_delivery_routes_driver ON public.delivery_routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_route_assignments_route ON public.route_order_assignments(route_id);
CREATE INDEX IF NOT EXISTS idx_route_assignments_order ON public.route_order_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_drivers_active ON public.drivers(is_active);