-- Fix recursive pg_notify function
DROP FUNCTION IF EXISTS public.pg_notify(text, text);

-- Create a safe version that calls the system function directly
CREATE OR REPLACE FUNCTION public.pg_notify_safe(channel text, payload text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Call the system pg_notify function directly to avoid recursion
  PERFORM pg_catalog.pg_notify(channel, payload);
END;
$$;

-- Create effective rate limiting function for public API
CREATE OR REPLACE FUNCTION public.increment_api_rate_limit(
  p_identifier text,
  p_endpoint text,
  p_max_requests integer DEFAULT 100,
  p_window_minutes integer DEFAULT 60
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_window_start timestamptz;
  v_current_count integer := 0;
  v_allowed boolean := true;
BEGIN
  v_window_start := NOW() - (p_window_minutes || ' minutes')::interval;
  
  -- Clean up old entries first
  DELETE FROM api_rate_limits 
  WHERE window_start < v_window_start;
  
  -- Get current count for this identifier/endpoint combination
  SELECT COALESCE(SUM(request_count), 0) INTO v_current_count
  FROM api_rate_limits
  WHERE identifier = p_identifier 
    AND endpoint = p_endpoint
    AND window_start >= v_window_start;
  
  -- Check if limit exceeded
  IF v_current_count >= p_max_requests THEN
    v_allowed := false;
  ELSE
    -- Increment the count
    INSERT INTO api_rate_limits (identifier, endpoint, request_count, window_start)
    VALUES (p_identifier, p_endpoint, 1, NOW())
    ON CONFLICT (identifier, endpoint, window_start) 
    DO UPDATE SET request_count = api_rate_limits.request_count + 1;
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current_count', v_current_count + CASE WHEN v_allowed THEN 1 ELSE 0 END,
    'limit', p_max_requests,
    'window_minutes', p_window_minutes,
    'reset_at', (NOW() + (p_window_minutes || ' minutes')::interval)
  );
END;
$$;

-- Restrict categories RLS - Remove overly permissive policy
DROP POLICY IF EXISTS "Allow authenticated users full access to categories" ON categories;

-- Enable RLS on communication_events_archive if not already enabled
ALTER TABLE communication_events_archive ENABLE ROW LEVEL SECURITY;

-- Add restrictive policies for archive table
CREATE POLICY "Admins can view communication archive" ON communication_events_archive
FOR SELECT USING (is_admin());

-- Service roles can manage archive for cleanup operations
CREATE POLICY "Service roles can manage communication archive" ON communication_events_archive
FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Create table for order access tokens
CREATE TABLE IF NOT EXISTS order_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  UNIQUE(order_id)
);

-- Enable RLS on order access tokens
ALTER TABLE order_access_tokens ENABLE ROW LEVEL SECURITY;

-- Only service roles can manage tokens
CREATE POLICY "Service roles can manage order tokens" ON order_access_tokens
FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Function to generate secure order access tokens
CREATE OR REPLACE FUNCTION public.generate_order_access_token(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token text;
  v_expires_at timestamptz;
BEGIN
  -- Generate a secure token valid for 1 hour
  v_token := encode(gen_random_bytes(32), 'base64url');
  v_expires_at := NOW() + interval '1 hour';
  
  -- Store the token
  INSERT INTO order_access_tokens (order_id, token, expires_at)
  VALUES (p_order_id, v_token, v_expires_at)
  ON CONFLICT (order_id) DO UPDATE SET
    token = EXCLUDED.token,
    expires_at = EXCLUDED.expires_at;
  
  RETURN v_token;
END;
$$;

-- Function to validate order access token
CREATE OR REPLACE FUNCTION public.validate_order_access_token(p_order_id uuid, p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_valid boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM order_access_tokens
    WHERE order_id = p_order_id 
      AND token = p_token 
      AND expires_at > NOW()
  ) INTO v_valid;
  
  RETURN v_valid;
END;
$$;