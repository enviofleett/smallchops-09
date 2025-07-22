
-- Create delivery_zones table to store geographical areas
CREATE TABLE public.delivery_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  area JSONB NOT NULL, -- Storing GeoJSON Polygon coordinates
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for delivery_zones
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

-- Policies for delivery_zones: Admins can manage, others can read.
CREATE POLICY "Allow all access for admin users on delivery_zones"
ON public.delivery_zones
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Allow read access for authenticated users on delivery_zones"
ON public.delivery_zones
FOR SELECT
USING (auth.role() = 'authenticated');


-- Create delivery_fees table to store fee structures for each zone
CREATE TABLE public.delivery_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_id UUID NOT NULL REFERENCES public.delivery_zones(id) ON DELETE CASCADE,
  base_fee NUMERIC NOT NULL DEFAULT 0,
  fee_per_km NUMERIC,
  min_order_for_free_delivery NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for delivery_fees
ALTER TABLE public.delivery_fees ENABLE ROW LEVEL SECURITY;

-- Policies for delivery_fees: Admins can manage, others can read.
CREATE POLICY "Allow all access for admin users on delivery_fees"
ON public.delivery_fees
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Allow read access for authenticated users on delivery_fees"
ON public.delivery_fees
FOR SELECT
USING (auth.role() = 'authenticated');


-- Add columns to the orders table for delivery fee information
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC,
ADD COLUMN IF NOT EXISTS delivery_zone_id UUID REFERENCES public.delivery_zones(id) ON DELETE SET NULL;
