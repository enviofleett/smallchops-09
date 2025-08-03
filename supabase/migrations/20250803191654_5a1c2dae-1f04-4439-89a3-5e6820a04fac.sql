-- Phase 3: Enhanced Authentication Security & Session Management
-- ===============================================================

-- Create enhanced admin session management
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  terminated_at TIMESTAMP WITH TIME ZONE,
  termination_reason TEXT
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON public.admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON public.admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON public.admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON public.admin_sessions(is_active);

-- Enable RLS
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin sessions
CREATE POLICY "Admins can view their own sessions" ON public.admin_sessions
  FOR SELECT USING (auth.uid() = user_id AND is_admin());

CREATE POLICY "System can manage admin sessions" ON public.admin_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Create production monitoring tables
CREATE TABLE IF NOT EXISTS public.system_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('gauge', 'counter', 'histogram')),
  tags JSONB DEFAULT '{}',
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')) DEFAULT 'info'
);

CREATE INDEX IF NOT EXISTS idx_health_metrics_name ON public.system_health_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_health_metrics_recorded ON public.system_health_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_health_metrics_severity ON public.system_health_metrics(severity);

-- Enable RLS
ALTER TABLE public.system_health_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for health metrics
CREATE POLICY "Admins can view health metrics" ON public.system_health_metrics
  FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can insert health metrics" ON public.system_health_metrics
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Create performance monitoring table
CREATE TABLE IF NOT EXISTS public.performance_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  response_time_ms INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  database_query_time_ms INTEGER,
  cache_hit BOOLEAN DEFAULT false,
  error_details JSONB,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_endpoint ON public.performance_analytics(endpoint);
CREATE INDEX IF NOT EXISTS idx_performance_recorded ON public.performance_analytics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_performance_response_time ON public.performance_analytics(response_time_ms);

-- Enable RLS
ALTER TABLE public.performance_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for performance analytics
CREATE POLICY "Admins can view performance analytics" ON public.performance_analytics
  FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can insert performance analytics" ON public.performance_analytics
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Create security monitoring table
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  source_ip INET,
  user_id UUID REFERENCES auth.users(id),
  affected_resource TEXT,
  detection_method TEXT,
  raw_data JSONB,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
  assigned_to UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON public.security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON public.security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON public.security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON public.security_alerts(created_at);

-- Enable RLS
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for security alerts
CREATE POLICY "Admins can view security alerts" ON public.security_alerts
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can update security alerts" ON public.security_alerts
  FOR UPDATE USING (is_admin());

CREATE POLICY "Service roles can manage security alerts" ON public.security_alerts
  FOR ALL USING (auth.role() = 'service_role');

-- Enhanced authentication functions
CREATE OR REPLACE FUNCTION public.create_admin_session(
  p_user_id UUID,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_token TEXT;
  v_existing_sessions INTEGER;
BEGIN
  -- Generate secure session token
  v_session_token := encode(gen_random_bytes(32), 'base64');
  
  -- Check for existing active sessions (limit to 5 per user)
  SELECT COUNT(*) INTO v_existing_sessions
  FROM admin_sessions
  WHERE user_id = p_user_id AND is_active = true;
  
  -- If too many sessions, deactivate oldest
  IF v_existing_sessions >= 5 THEN
    UPDATE admin_sessions
    SET is_active = false,
        terminated_at = NOW(),
        termination_reason = 'session_limit_exceeded'
    WHERE user_id = p_user_id
      AND is_active = true
      AND id = (
        SELECT id FROM admin_sessions
        WHERE user_id = p_user_id AND is_active = true
        ORDER BY last_activity ASC
        LIMIT 1
      );
  END IF;
  
  -- Create new session
  INSERT INTO admin_sessions (
    user_id, session_token, ip_address, user_agent
  ) VALUES (
    p_user_id, v_session_token, p_ip_address, p_user_agent
  );
  
  RETURN v_session_token;
END;
$$;

-- Function to validate and update session
CREATE OR REPLACE FUNCTION public.validate_admin_session(
  p_session_token TEXT,
  p_ip_address INET DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_result JSONB;
BEGIN
  -- Get session details
  SELECT * INTO v_session
  FROM admin_sessions
  WHERE session_token = p_session_token
    AND is_active = true
    AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'invalid_or_expired_session'
    );
  END IF;
  
  -- Check for IP address changes (security feature)
  IF v_session.ip_address IS NOT NULL 
     AND p_ip_address IS NOT NULL 
     AND v_session.ip_address != p_ip_address THEN
    -- Log suspicious activity
    INSERT INTO security_alerts (
      alert_type, severity, title, description, source_ip, user_id
    ) VALUES (
      'session_ip_change', 'medium', 'Session IP Address Change',
      'User session accessed from different IP address', p_ip_address, v_session.user_id
    );
  END IF;
  
  -- Update last activity
  UPDATE admin_sessions
  SET last_activity = NOW()
  WHERE session_token = p_session_token;
  
  RETURN jsonb_build_object(
    'valid', true,
    'user_id', v_session.user_id,
    'expires_at', v_session.expires_at
  );
END;
$$;

-- Function to record system health metrics
CREATE OR REPLACE FUNCTION public.record_health_metric(
  p_metric_name TEXT,
  p_metric_value NUMERIC,
  p_metric_type TEXT DEFAULT 'gauge',
  p_tags JSONB DEFAULT '{}',
  p_severity TEXT DEFAULT 'info'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metric_id UUID;
BEGIN
  INSERT INTO system_health_metrics (
    metric_name, metric_value, metric_type, tags, severity
  ) VALUES (
    p_metric_name, p_metric_value, p_metric_type, p_tags, p_severity
  ) RETURNING id INTO v_metric_id;
  
  -- If critical metric, create alert
  IF p_severity = 'critical' THEN
    INSERT INTO security_alerts (
      alert_type, severity, title, description, raw_data
    ) VALUES (
      'system_health', 'critical',
      'Critical System Metric: ' || p_metric_name,
      'System metric ' || p_metric_name || ' reached critical value: ' || p_metric_value,
      jsonb_build_object('metric_id', v_metric_id, 'metric_value', p_metric_value)
    );
  END IF;
  
  RETURN v_metric_id;
END;
$$;

-- Function to record performance analytics
CREATE OR REPLACE FUNCTION public.record_performance_metric(
  p_endpoint TEXT,
  p_method TEXT,
  p_response_time_ms INTEGER,
  p_status_code INTEGER,
  p_user_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_size_bytes INTEGER DEFAULT NULL,
  p_response_size_bytes INTEGER DEFAULT NULL,
  p_database_query_time_ms INTEGER DEFAULT NULL,
  p_cache_hit BOOLEAN DEFAULT false,
  p_error_details JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metric_id UUID;
BEGIN
  INSERT INTO performance_analytics (
    endpoint, method, response_time_ms, status_code, user_id,
    ip_address, user_agent, request_size_bytes, response_size_bytes,
    database_query_time_ms, cache_hit, error_details
  ) VALUES (
    p_endpoint, p_method, p_response_time_ms, p_status_code, p_user_id,
    p_ip_address, p_user_agent, p_request_size_bytes, p_response_size_bytes,
    p_database_query_time_ms, p_cache_hit, p_error_details
  ) RETURNING id INTO v_metric_id;
  
  -- Create performance alert if response time is too high
  IF p_response_time_ms > 5000 THEN -- 5 seconds threshold
    INSERT INTO security_alerts (
      alert_type, severity, title, description, user_id, raw_data
    ) VALUES (
      'performance_degradation', 'medium',
      'Slow API Response: ' || p_endpoint,
      'Endpoint ' || p_endpoint || ' responded in ' || p_response_time_ms || 'ms',
      p_user_id,
      jsonb_build_object('performance_id', v_metric_id, 'response_time', p_response_time_ms)
    );
  END IF;
  
  RETURN v_metric_id;
END;
$$;

-- Function to clean up old sessions and analytics data
CREATE OR REPLACE FUNCTION public.cleanup_monitoring_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clean up expired sessions
  UPDATE admin_sessions
  SET is_active = false,
      terminated_at = NOW(),
      termination_reason = 'expired'
  WHERE expires_at < NOW() AND is_active = true;
  
  -- Delete old performance analytics (keep 30 days)
  DELETE FROM performance_analytics
  WHERE recorded_at < NOW() - INTERVAL '30 days';
  
  -- Delete old health metrics (keep 90 days)
  DELETE FROM system_health_metrics
  WHERE recorded_at < NOW() - INTERVAL '90 days';
  
  -- Auto-resolve old security alerts (keep 1 year)
  UPDATE security_alerts
  SET status = 'resolved',
      resolved_at = NOW(),
      resolution_notes = 'Auto-resolved due to age'
  WHERE created_at < NOW() - INTERVAL '365 days'
    AND status = 'open';
    
  -- Log cleanup completion
  INSERT INTO audit_logs (action, category, message)
  VALUES ('data_cleanup', 'System Maintenance', 'Completed monitoring data cleanup');
END;
$$;

-- Create automated cleanup schedule (this would typically be run via cron)
-- Note: In production, this should be scheduled as a recurring job

-- Update existing functions to include monitoring
CREATE OR REPLACE FUNCTION public.enhanced_security_check()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failed_logins INTEGER;
  v_suspicious_activities INTEGER;
  v_blocked_ips INTEGER;
  v_security_score NUMERIC := 100;
  v_alerts TEXT[] := '{}';
BEGIN
  -- Check failed login attempts in last hour
  SELECT COUNT(*) INTO v_failed_logins
  FROM security_incidents
  WHERE type = 'authentication_failure'
    AND created_at > NOW() - INTERVAL '1 hour';
    
  IF v_failed_logins > 10 THEN
    v_security_score := v_security_score - 20;
    v_alerts := array_append(v_alerts, 'High number of failed login attempts');
  END IF;
  
  -- Check for suspicious activities
  SELECT COUNT(*) INTO v_suspicious_activities
  FROM security_alerts
  WHERE severity IN ('high', 'critical')
    AND status = 'open'
    AND created_at > NOW() - INTERVAL '24 hours';
    
  IF v_suspicious_activities > 5 THEN
    v_security_score := v_security_score - 30;
    v_alerts := array_append(v_alerts, 'Multiple high-severity security alerts');
  END IF;
  
  -- Record security health metric
  PERFORM record_health_metric(
    'security_score',
    v_security_score,
    'gauge',
    jsonb_build_object('failed_logins', v_failed_logins, 'suspicious_activities', v_suspicious_activities),
    CASE 
      WHEN v_security_score < 50 THEN 'critical'
      WHEN v_security_score < 75 THEN 'warning'
      ELSE 'info'
    END
  );
  
  RETURN jsonb_build_object(
    'security_score', v_security_score,
    'failed_logins', v_failed_logins,
    'suspicious_activities', v_suspicious_activities,
    'alerts', v_alerts,
    'status', CASE 
      WHEN v_security_score >= 90 THEN 'excellent'
      WHEN v_security_score >= 75 THEN 'good'
      WHEN v_security_score >= 50 THEN 'moderate'
      ELSE 'critical'
    END
  );
END;
$$;