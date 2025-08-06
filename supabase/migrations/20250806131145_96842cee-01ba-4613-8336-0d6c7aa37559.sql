-- Remove the legacy create_order_with_items function that returns jsonb
-- Keep only the UUID-returning version with proper parameter types

DROP FUNCTION IF EXISTS public.create_order_with_items(
  p_customer_email text,
  p_customer_name text,
  p_items jsonb,
  p_customer_phone text,
  p_fulfillment_type text,
  p_delivery_address jsonb,
  p_guest_session_id text,
  p_payment_method text,
  p_delivery_zone_id uuid,
  p_delivery_fee numeric,
  p_total_amount numeric
);

-- Also remove any other legacy versions to ensure clean state
DROP FUNCTION IF EXISTS public.create_order_with_items(text, text, jsonb, text, text, jsonb, text, text, uuid, numeric, numeric);

-- Verify only our correct UUID-returning function remains
-- This should be the only create_order_with_items function:
-- create_order_with_items(p_customer_id uuid, p_fulfillment_type text, p_delivery_address jsonb, p_pickup_point_id uuid, p_delivery_zone_id uuid, p_guest_session_id uuid, p_items jsonb)

-- Add pickup_points table for validation if it doesn't exist
CREATE TABLE IF NOT EXISTS public.pickup_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  phone text,
  email text,
  operating_hours jsonb,
  coordinates jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on pickup_points
ALTER TABLE public.pickup_points ENABLE ROW LEVEL SECURITY;

-- Add policies for pickup_points
CREATE POLICY "Public can view active pickup points" ON public.pickup_points
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage pickup points" ON public.pickup_points
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Insert a default pickup point for testing
INSERT INTO public.pickup_points (name, address, phone, is_active)
VALUES ('Main Store', '123 Main Street, Lagos, Nigeria', '+234-123-456-7890', true)
ON CONFLICT DO NOTHING;