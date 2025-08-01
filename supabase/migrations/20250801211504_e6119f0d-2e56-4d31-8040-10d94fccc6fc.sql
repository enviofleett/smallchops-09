-- Fix security linter warnings

-- Fix function search path by setting stable search_path for relevant functions
-- Update the existing function to have a stable search_path
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
STABLE
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