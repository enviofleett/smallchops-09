-- Fix security issues by adding search path to new functions
DROP FUNCTION IF EXISTS generate_guest_session_id();
DROP FUNCTION IF EXISTS convert_guest_cart_to_customer(TEXT, UUID);
DROP FUNCTION IF EXISTS cleanup_old_guest_sessions();

-- Recreate functions with proper security settings
CREATE OR REPLACE FUNCTION generate_guest_session_id()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN 'guest_' || encode(gen_random_bytes(16), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION convert_guest_cart_to_customer(
  p_guest_session_id TEXT,
  p_customer_id UUID
)
RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_cart_count INTEGER;
  v_order_count INTEGER;
BEGIN
  -- Update cart sessions
  UPDATE public.cart_sessions 
  SET 
    converted_to_customer_id = p_customer_id,
    customer_id = p_customer_id,
    updated_at = NOW()
  WHERE session_id = p_guest_session_id;
  
  GET DIAGNOSTICS v_cart_count = ROW_COUNT;
  
  -- Update orders
  UPDATE public.orders 
  SET 
    customer_id = p_customer_id,
    updated_at = NOW()
  WHERE guest_session_id = p_guest_session_id;
  
  GET DIAGNOSTICS v_order_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'carts_converted', v_cart_count,
    'orders_converted', v_order_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_old_guest_sessions()
RETURNS INTEGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete cart sessions older than 30 days that weren't converted
  DELETE FROM public.cart_sessions 
  WHERE 
    session_id LIKE 'guest_%' 
    AND converted_to_customer_id IS NULL 
    AND created_at < NOW() - INTERVAL '30 days';
    
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;