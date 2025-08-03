-- Fix orders table RLS policies to allow admin access
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage orders" ON orders;

-- Create proper admin policies for orders
CREATE POLICY "Admins can manage orders" ON orders
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Create cart sessions table for abandoned cart tracking
CREATE TABLE IF NOT EXISTS cart_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  customer_id UUID REFERENCES customer_accounts(id),
  customer_email TEXT,
  customer_phone TEXT,
  cart_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_items INTEGER DEFAULT 0,
  total_value NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_activity TIMESTAMPTZ DEFAULT now(),
  is_abandoned BOOLEAN DEFAULT false,
  checkout_started_at TIMESTAMPTZ,
  abandoned_at TIMESTAMPTZ
);

-- Enable RLS on cart_sessions
ALTER TABLE cart_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for cart_sessions
CREATE POLICY "Admins can view all cart sessions" ON cart_sessions
FOR SELECT
TO authenticated
USING (is_admin());

CREATE POLICY "Service roles can manage cart sessions" ON cart_sessions
FOR ALL
TO authenticated
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cart_sessions_session_id ON cart_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_cart_sessions_customer_email ON cart_sessions(customer_email);
CREATE INDEX IF NOT EXISTS idx_cart_sessions_last_activity ON cart_sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_cart_sessions_is_abandoned ON cart_sessions(is_abandoned);

-- Create function to detect abandoned carts
CREATE OR REPLACE FUNCTION detect_abandoned_carts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Mark carts as abandoned if no activity for 30 minutes
  UPDATE cart_sessions 
  SET 
    is_abandoned = true,
    abandoned_at = now()
  WHERE 
    is_abandoned = false 
    AND last_activity < (now() - INTERVAL '30 minutes')
    AND total_items > 0;
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$$;

-- Create function to get cart time ago
CREATE OR REPLACE FUNCTION get_time_ago(target_time TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  diff INTERVAL;
  seconds INTEGER;
  minutes INTEGER;
  hours INTEGER;
  days INTEGER;
BEGIN
  diff := now() - target_time;
  seconds := EXTRACT(EPOCH FROM diff)::INTEGER;
  
  IF seconds < 60 THEN
    RETURN seconds || ' seconds ago';
  END IF;
  
  minutes := seconds / 60;
  IF minutes < 60 THEN
    RETURN minutes || ' mins ago';
  END IF;
  
  hours := minutes / 60;
  IF hours < 24 THEN
    RETURN hours || ' hours ago';
  END IF;
  
  days := hours / 24;
  IF days = 1 THEN
    RETURN '1 day ago';
  ELSE
    RETURN days || ' days ago';
  END IF;
END;
$$;