-- Create missing database functions and fix existing schema issues

-- Ensure drivers table has proper RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'drivers' AND policyname = 'Admins can manage drivers'
  ) THEN
    CREATE POLICY "Admins can manage drivers" ON public.drivers
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin());
  END IF;
END$$;

-- Ensure route_order_assignments table has proper RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'route_order_assignments' AND policyname = 'Admins can manage route assignments'
  ) THEN
    CREATE POLICY "Admins can manage route assignments" ON public.route_order_assignments
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin());
  END IF;
END$$;

-- Enable RLS on tables if not already enabled
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_order_assignments ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_delivery_routes_date ON public.delivery_routes(route_date);
CREATE INDEX IF NOT EXISTS idx_delivery_routes_driver ON public.delivery_routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_route_assignments_route ON public.route_order_assignments(route_id);
CREATE INDEX IF NOT EXISTS idx_route_assignments_order ON public.route_order_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_drivers_active ON public.drivers(is_active);

-- Update existing types to ensure compatibility
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
    CREATE TYPE delivery_status AS ENUM ('pending', 'en_route', 'delivered', 'failed');
  END IF;
END$$;

-- Ensure route_order_assignments has proper delivery_status type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'route_order_assignments' 
    AND column_name = 'delivery_status' 
    AND data_type = 'text'
  ) THEN
    -- Convert text column to enum if needed
    ALTER TABLE public.route_order_assignments 
    ALTER COLUMN delivery_status TYPE delivery_status USING delivery_status::delivery_status;
  END IF;
END$$;