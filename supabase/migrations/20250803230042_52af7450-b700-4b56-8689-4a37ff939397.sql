-- Fix cart_sessions table constraints and improve performance
-- Add unique constraint on session_id to support upsert operations
ALTER TABLE public.cart_sessions 
ADD CONSTRAINT cart_sessions_session_id_unique UNIQUE (session_id);

-- Add index on abandoned_at for faster queries
CREATE INDEX IF NOT EXISTS idx_cart_sessions_abandoned_at 
ON public.cart_sessions (abandoned_at DESC) 
WHERE is_abandoned = true;

-- Add index on customer queries
CREATE INDEX IF NOT EXISTS idx_cart_sessions_customer 
ON public.cart_sessions (customer_email, customer_id) 
WHERE is_abandoned = true;

-- Drop and recreate the abandoned cart detection function
DROP FUNCTION IF EXISTS detect_abandoned_carts();

CREATE OR REPLACE FUNCTION detect_abandoned_carts()
RETURNS void AS $$
BEGIN
  -- Mark carts as abandoned if they haven't been updated in 30 minutes
  UPDATE public.cart_sessions 
  SET 
    is_abandoned = true,
    abandoned_at = COALESCE(abandoned_at, last_activity)
  WHERE 
    is_abandoned = false 
    AND last_activity < NOW() - INTERVAL '30 minutes'
    AND total_items > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;