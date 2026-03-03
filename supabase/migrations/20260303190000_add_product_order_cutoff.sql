-- Add order_cutoff_time to products table
-- This allows admins to set a time by which orders for this product must be placed
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS order_cutoff_time TIME WITHOUT TIME ZONE;

COMMENT ON COLUMN public.products.order_cutoff_time IS 'Time of day after which this product cannot be ordered (e.g. 14:00)';
