-- Add guest session support to existing tables
ALTER TABLE public.orders 
ADD COLUMN guest_session_id TEXT;

ALTER TABLE public.cart_sessions 
ADD COLUMN converted_to_customer_id UUID REFERENCES public.customers(id);

-- Create index for guest session lookups
CREATE INDEX IF NOT EXISTS idx_orders_guest_session 
ON public.orders (guest_session_id) 
WHERE guest_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cart_sessions_converted 
ON public.cart_sessions (converted_to_customer_id) 
WHERE converted_to_customer_id IS NOT NULL;

-- Create function to generate guest session ID
CREATE OR REPLACE FUNCTION generate_guest_session_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'guest_' || encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Create function to convert guest cart to customer
CREATE OR REPLACE FUNCTION convert_guest_cart_to_customer(
  p_guest_session_id TEXT,
  p_customer_id UUID
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to clean up old guest sessions
CREATE OR REPLACE FUNCTION cleanup_old_guest_sessions()
RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;