-- Create pickup points table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.pickup_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT,
  phone TEXT,
  email TEXT,
  operating_hours JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  instructions TEXT,
  contact_person TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.pickup_points ENABLE ROW LEVEL SECURITY;

-- Policies for pickup points
CREATE POLICY "Public can view active pickup points" 
ON public.pickup_points 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage pickup points" 
ON public.pickup_points 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_pickup_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pickup_points_updated_at
BEFORE UPDATE ON public.pickup_points
FOR EACH ROW
EXECUTE FUNCTION public.update_pickup_points_updated_at();