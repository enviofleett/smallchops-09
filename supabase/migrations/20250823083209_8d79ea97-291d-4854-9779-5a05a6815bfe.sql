-- Enable RLS on tables that are missing it (critical security issue)
ALTER TABLE business_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_sensitive_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE branding_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_execution_logs ENABLE ROW LEVEL SECURITY;

-- Add missing RLS policies for newly enabled tables
CREATE POLICY "Admins can view business analytics" ON business_analytics
FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can insert business analytics" ON business_analytics
FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admin access only" ON business_sensitive_data
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin access only" ON branding_audit_log
FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can insert branding audit" ON branding_audit_log
FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admin access system health" ON system_health_checks
FOR SELECT USING (is_admin());

CREATE POLICY "Service roles manage system health" ON system_health_checks
FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Fix function search paths (security warning resolution)
CREATE OR REPLACE FUNCTION public.similarity(text, text)
RETURNS real
LANGUAGE c
IMMUTABLE PARALLEL SAFE STRICT
SET search_path TO 'public'
AS '$libdir/pg_trgm';

CREATE OR REPLACE FUNCTION public.word_similarity(text, text)
RETURNS real
LANGUAGE c
IMMUTABLE PARALLEL SAFE STRICT  
SET search_path TO 'public'
AS '$libdir/pg_trgm';

CREATE OR REPLACE FUNCTION public.strict_word_similarity(text, text)
RETURNS real
LANGUAGE c
IMMUTABLE PARALLEL SAFE STRICT
SET search_path TO 'public'
AS '$libdir/pg_trgm';

-- Add comprehensive audit logging for all security-sensitive operations
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_severity text DEFAULT 'medium',
  p_description text DEFAULT '',
  p_metadata jsonb DEFAULT '{}'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO audit_logs (
    action,
    category, 
    message,
    user_id,
    new_values,
    event_time
  ) VALUES (
    p_event_type,
    'Security',
    p_description,
    auth.uid(),
    p_metadata || jsonb_build_object(
      'severity', p_severity,
      'timestamp', NOW(),
      'user_role', auth.role()
    ),
    NOW()
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;