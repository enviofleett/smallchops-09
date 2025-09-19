-- Fix security warnings: Enable RLS on new tables

-- Enable RLS on order_update_locks table
ALTER TABLE order_update_locks ENABLE ROW LEVEL SECURITY;

-- Create policies for order_update_locks (admins and service role only)
CREATE POLICY "Admins can view order update locks" 
ON order_update_locks FOR SELECT 
USING (is_admin());

CREATE POLICY "Service role can manage order update locks" 
ON order_update_locks FOR ALL 
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Enable RLS on request_cache table
ALTER TABLE request_cache ENABLE ROW LEVEL SECURITY;

-- Create policies for request_cache (admins and service role only)
CREATE POLICY "Admins can view request cache" 
ON request_cache FOR SELECT 
USING (is_admin());

CREATE POLICY "Service role can manage request cache" 
ON request_cache FOR ALL 
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);