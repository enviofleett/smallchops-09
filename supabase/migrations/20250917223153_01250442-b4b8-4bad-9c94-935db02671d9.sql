-- SECURITY ENHANCEMENT: Ensure audit_logs table supports webhook security logging
-- This migration adds any missing columns and indexes for security monitoring

-- Create audit_logs table if it doesn't exist (it should already exist based on context)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  message TEXT,
  user_id UUID,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  event_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit_logs for security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Add indexes for performance on security monitoring queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_category_event_time 
ON public.audit_logs(category, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_event_time 
ON public.audit_logs(action, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_webhook_security 
ON public.audit_logs(category, event_time DESC) 
WHERE category = 'webhook_security';

-- Create RLS policies for audit_logs (admin-only access)
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs
FOR SELECT
USING (is_admin());

CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Create function to clean up old audit logs (keep last 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Create security monitoring view for easy querying
CREATE OR REPLACE VIEW public.security_monitor_view AS
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

-- Grant permissions
GRANT SELECT ON public.security_monitor_view TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_logs TO service_role;