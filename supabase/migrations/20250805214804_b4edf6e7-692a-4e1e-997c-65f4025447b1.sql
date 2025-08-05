-- Remove the conflicting 3-parameter version of create_order_with_items function
-- This resolves the PostgreSQL function overloading issue causing checkout failures

DROP FUNCTION IF EXISTS public.create_order_with_items(p_customer_email text, p_customer_name text, p_items jsonb);

-- Add comment to document the fix
COMMENT ON FUNCTION public.create_order_with_items(p_customer_email text, p_customer_name text, p_items jsonb, p_customer_phone text, p_fulfillment_type text, p_delivery_address jsonb, p_guest_session_id text, p_payment_method text) IS 'Enhanced order creation function with full parameter support. Resolves function overloading conflict.';