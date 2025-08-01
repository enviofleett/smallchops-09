-- Add delivery_zone_id column to orders table and create public delivery zones endpoint

-- First, add the delivery_zone_id column to orders table
ALTER TABLE public.orders 
ADD COLUMN delivery_zone_id UUID REFERENCES public.delivery_zones(id);

-- Add index for better performance
CREATE INDEX idx_orders_delivery_zone_id ON public.orders(delivery_zone_id);

-- Update RLS policies for delivery zones to allow public viewing
CREATE POLICY "Public can view delivery zones for checkout" 
ON public.delivery_zones 
FOR SELECT 
USING (true);

-- Update RLS policies for delivery fees to allow public viewing  
CREATE POLICY "Public can view delivery fees for checkout"
ON public.delivery_fees
FOR SELECT
USING (true);

-- Create a function to get delivery zones with fees for public use
CREATE OR REPLACE FUNCTION public.get_public_delivery_zones()
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  base_fee NUMERIC,
  fee_per_km NUMERIC,
  min_order_for_free_delivery NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dz.id,
    dz.name,
    dz.description,
    COALESCE(df.base_fee, 0) as base_fee,
    df.fee_per_km,
    df.min_order_for_free_delivery
  FROM delivery_zones dz
  LEFT JOIN delivery_fees df ON dz.id = df.zone_id
  ORDER BY dz.name;
END;
$$;