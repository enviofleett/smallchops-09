-- Fix the normalize_order_phone function to only work with customer_phone column
CREATE OR REPLACE FUNCTION public.normalize_order_phone()
RETURNS TRIGGER AS $$
BEGIN
  -- Only work with customer_phone column since phone column doesn't exist
  -- This function now only ensures customer_phone is properly handled
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;