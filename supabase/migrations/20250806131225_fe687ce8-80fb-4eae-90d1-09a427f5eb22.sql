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

-- Log the cleanup for audit purposes
INSERT INTO public.audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'cleanup_legacy_functions',
  'Database Maintenance',
  'Removed legacy create_order_with_items functions to ensure single correct version',
  jsonb_build_object(
    'remaining_function', 'create_order_with_items(uuid, text, jsonb, uuid, uuid, uuid, jsonb)',
    'cleanup_date', now()
  )
);