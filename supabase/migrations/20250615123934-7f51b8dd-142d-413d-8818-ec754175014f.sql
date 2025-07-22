
-- Enable Row-Level Security on the delivery zones table
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- Create a policy to ensure only admins can perform any action on delivery zones
CREATE POLICY "Admins can manage delivery_zones"
ON public.delivery_zones
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Enable Row-Level Security on the delivery fees table
ALTER TABLE public.delivery_fees ENABLE ROW LEVEL SECURITY;

-- Create a policy to ensure only admins can perform any action on delivery fees
CREATE POLICY "Admins can manage delivery_fees"
ON public.delivery_fees
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());
