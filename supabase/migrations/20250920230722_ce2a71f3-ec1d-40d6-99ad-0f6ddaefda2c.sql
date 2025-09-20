-- Alert Infrastructure Schema
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(100) NOT NULL,
    condition_sql TEXT NOT NULL,
    threshold_value NUMERIC,
    check_interval_seconds INTEGER DEFAULT 300,
    severity VARCHAR(20) DEFAULT 'warning',
    webhook_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

-- Alert notifications log
CREATE TABLE IF NOT EXISTS alert_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_rule_id UUID REFERENCES alert_rules(id),
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    webhook_url TEXT,
    delivery_status VARCHAR(20) DEFAULT 'pending',
    response_code INTEGER,
    response_body TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

-- Circuit breaker state tracking
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100) NOT NULL UNIQUE,
    state VARCHAR(20) NOT NULL DEFAULT 'closed',
    failure_count INTEGER DEFAULT 0,
    last_failure_time TIMESTAMPTZ,
    last_success_time TIMESTAMPTZ,
    next_retry_time TIMESTAMPTZ,
    failure_threshold INTEGER DEFAULT 5,
    timeout_seconds INTEGER DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook delivery tracking for alert throttling
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_url TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    response_code INTEGER,
    response_body TEXT,
    delivery_attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    throttled_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default alert rules
INSERT INTO alert_rules (rule_name, condition_sql, threshold_value, severity, check_interval_seconds) VALUES
('High Error Rate', 
 'SELECT COUNT(CASE WHEN status = ''error'' THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC * 100 FROM order_update_metrics WHERE timestamp >= NOW() - INTERVAL ''5 minutes''',
 10.0, 'critical', 300),

('Slow Response Times',
 'SELECT AVG(duration_ms) FROM order_update_metrics WHERE timestamp >= NOW() - INTERVAL ''5 minutes'' AND status = ''success''',
 2000.0, 'warning', 300),

('High Lock Contention',
 'SELECT COUNT(*) FROM order_update_locks WHERE expires_at > NOW() AND released_at IS NULL',
 10.0, 'warning', 180),

('Database Connection Failures',
 'SELECT COUNT(*) FROM order_update_metrics WHERE timestamp >= NOW() - INTERVAL ''1 minute'' AND error_code = ''DB_UNAVAILABLE''',
 1.0, 'critical', 60),

('High 409 Conflict Rate',
 'SELECT COUNT(CASE WHEN error_code = ''CONCURRENT_UPDATE'' OR status = ''conflict'' THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC * 100 FROM order_update_metrics WHERE timestamp >= NOW() - INTERVAL ''5 minutes''',
 15.0, 'warning', 300),

('Circuit Breaker Open',
 'SELECT COUNT(*) FROM circuit_breaker_state WHERE state = ''open'' AND next_retry_time > NOW()',
 1.0, 'critical', 60);

-- RLS Policies
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE circuit_breaker_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Policies for alert_rules
CREATE POLICY "Admins can manage alert rules" ON alert_rules
FOR ALL USING (is_admin())
WITH CHECK (is_admin());

-- Policies for alert_notifications  
CREATE POLICY "Admins can view alert notifications" ON alert_notifications
FOR SELECT USING (is_admin());

CREATE POLICY "Service role can manage alert notifications" ON alert_notifications
FOR ALL USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Policies for circuit_breaker_state
CREATE POLICY "Service role can manage circuit breaker state" ON circuit_breaker_state
FOR ALL USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view circuit breaker state" ON circuit_breaker_state
FOR SELECT USING (is_admin());

-- Policies for webhook_deliveries
CREATE POLICY "Service role can manage webhook deliveries" ON webhook_deliveries
FOR ALL USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view webhook deliveries" ON webhook_deliveries
FOR SELECT USING (is_admin());

-- Indexes for performance
CREATE INDEX idx_alert_rules_active ON alert_rules(is_active, check_interval_seconds);
CREATE INDEX idx_alert_notifications_status ON alert_notifications(delivery_status, created_at);
CREATE INDEX idx_circuit_breaker_service ON circuit_breaker_state(service_name);
CREATE INDEX idx_webhook_deliveries_throttle ON webhook_deliveries(webhook_url, alert_type, throttled_until);

-- Function to check and trigger alerts
CREATE OR REPLACE FUNCTION check_alert_rules()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  rule RECORD;
  result NUMERIC;
  alert_triggered BOOLEAN := false;
  alerts_triggered INTEGER := 0;
  alerts_checked INTEGER := 0;
BEGIN
  FOR rule IN 
    SELECT * FROM alert_rules 
    WHERE is_active = true 
      AND (last_triggered_at IS NULL OR last_triggered_at < NOW() - (check_interval_seconds || ' seconds')::INTERVAL)
  LOOP
    alerts_checked := alerts_checked + 1;
    
    BEGIN
      EXECUTE rule.condition_sql INTO result;
      
      IF result >= rule.threshold_value THEN
        -- Update rule trigger info
        UPDATE alert_rules 
        SET 
          last_triggered_at = NOW(),
          trigger_count = trigger_count + 1,
          updated_at = NOW()
        WHERE id = rule.id;
        
        -- Insert alert notification
        INSERT INTO alert_notifications (
          alert_rule_id,
          message,
          severity,
          webhook_url
        ) VALUES (
          rule.id,
          format('%s triggered: %s (threshold: %s, actual: %s)', 
                rule.rule_name, 
                rule.condition_sql, 
                rule.threshold_value, 
                result),
          rule.severity,
          rule.webhook_url
        );
        
        alerts_triggered := alerts_triggered + 1;
        alert_triggered := true;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log failed alert check
      INSERT INTO audit_logs (action, category, message, new_values)
      VALUES (
        'alert_check_failed',
        'Alert System',
        'Alert rule check failed: ' || rule.rule_name,
        jsonb_build_object(
          'rule_id', rule.id,
          'error', SQLERRM,
          'sqlstate', SQLSTATE
        )
      );
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'alerts_checked', alerts_checked,
    'alerts_triggered', alerts_triggered,
    'any_triggered', alert_triggered,
    'timestamp', NOW()
  );
END;
$$;