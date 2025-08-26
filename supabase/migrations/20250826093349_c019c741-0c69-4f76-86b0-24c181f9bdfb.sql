-- Fix RLS policy for performance_analytics to allow anonymous error logging
-- This is needed for client-side error tracking to work properly

-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Service roles can insert performance analytics" ON performance_analytics;

-- Create new policy that allows anonymous users to insert error logs
CREATE POLICY "Allow error logging from clients" 
ON performance_analytics 
FOR INSERT 
WITH CHECK (
  -- Allow service roles and admins as before
  (auth.role() = 'service_role'::text) OR is_admin() OR
  -- Allow anonymous users to insert error logs only
  (auth.role() = 'anon'::text AND endpoint = 'client_error')
);