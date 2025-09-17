-- FIX SECURITY LINTER WARNINGS
-- This migration fixes the security definer view and other security warnings

-- Remove the problematic security definer view
DROP VIEW IF EXISTS public.security_monitor_view;

-- Recreate the view without SECURITY DEFINER (users will query directly with RLS)
CREATE VIEW public.security_monitor_view 
WITH (security_invoker = true) AS
SELECT 
  id,
  action,
  category,
  message,
  user_id,
  entity_id,
  new_values,
  event_time,
  CASE 
    WHEN category = 'webhook_security' AND action IN ('invalid_signature', 'invalid_source_ip') THEN 'HIGH'
    WHEN category = 'webhook_security' AND action = 'rate_limit_exceeded' THEN 'MEDIUM'
    WHEN category = 'webhook_security' THEN 'LOW'
    ELSE 'INFO'
  END as risk_level
FROM audit_logs
WHERE category IN ('webhook_security', 'Critical Payment Security', 'Payment Security')
ORDER BY event_time DESC;

-- Update the cleanup function to have proper search_path (already set, but ensure it's explicit)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs 
  WHERE event_time < (NOW() - INTERVAL '30 days')
  AND category NOT IN ('webhook_security', 'Critical Payment Security');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log cleanup activity
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'audit_log_cleanup',
    'System Maintenance',
    'Cleaned up old audit logs',
    jsonb_build_object('deleted_count', deleted_count, 'retention_days', 30)
  );
  
  RETURN deleted_count;
END;
$$;

-- Grant appropriate permissions for the security view
GRANT SELECT ON public.security_monitor_view TO authenticated;

-- Create a secure function for admins to query security events
CREATE OR REPLACE FUNCTION public.get_security_events(
  p_limit INTEGER DEFAULT 50,
  p_risk_level TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  category TEXT,
  message TEXT,
  user_id UUID,
  entity_id UUID,
  new_values JSONB,
  event_time TIMESTAMP WITH TIME ZONE,
  risk_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only admins can access security events
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT 
    al.id,
    al.action,
    al.category,
    al.message,
    al.user_id,
    al.entity_id,
    al.new_values,
    al.event_time,
    CASE 
      WHEN al.category = 'webhook_security' AND al.action IN ('invalid_signature', 'invalid_source_ip') THEN 'HIGH'
      WHEN al.category = 'webhook_security' AND al.action = 'rate_limit_exceeded' THEN 'MEDIUM'
      WHEN al.category = 'webhook_security' THEN 'LOW'
      ELSE 'INFO'
    END as risk_level
  FROM audit_logs al
  WHERE al.category IN ('webhook_security', 'Critical Payment Security', 'Payment Security')
    AND (p_risk_level IS NULL OR 
         CASE 
           WHEN al.category = 'webhook_security' AND al.action IN ('invalid_signature', 'invalid_source_ip') THEN 'HIGH'
           WHEN al.category = 'webhook_security' AND al.action = 'rate_limit_exceeded' THEN 'MEDIUM'
           WHEN al.category = 'webhook_security' THEN 'LOW'
           ELSE 'INFO'
         END = p_risk_level)
  ORDER BY al.event_time DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission to authenticated users (RLS will handle admin check)
GRANT EXECUTE ON FUNCTION public.get_security_events TO authenticated;