
-- 1. Create enums for vehicle and assignment status
CREATE TYPE vehicle_type AS ENUM ('bike', 'van', 'truck');
CREATE TYPE vehicle_status AS ENUM ('available', 'assigned', 'maintenance', 'inactive');
CREATE TYPE assignment_status AS ENUM ('active', 'inactive');

-- 2. Vehicles table: all vehicles managed in the system
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_plate TEXT UNIQUE NOT NULL,
  type vehicle_type NOT NULL,
  brand TEXT,
  model TEXT,
  status vehicle_status NOT NULL DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Vehicle assignments: map vehicles to dispatch riders (profiles)
CREATE TABLE public.vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) NOT NULL,
  dispatch_rider_id UUID REFERENCES public.profiles(id) NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES public.profiles(id),
  status assignment_status NOT NULL DEFAULT 'active',
  notes TEXT
);

-- 4. Enable Row Level Security
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_assignments ENABLE ROW LEVEL SECURITY;

-- 5. Admin users (role = 'admin' in profiles) can manage vehicles and assignments
CREATE POLICY "Admins can manage vehicles"
  ON public.vehicles
  FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can manage vehicle assignments"
  ON public.vehicle_assignments
  FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- 6. Dispatch riders can view THEIR own assignments only
CREATE POLICY "Riders can select their own assignments"
  ON public.vehicle_assignments
  FOR SELECT
  USING (dispatch_rider_id = auth.uid());
