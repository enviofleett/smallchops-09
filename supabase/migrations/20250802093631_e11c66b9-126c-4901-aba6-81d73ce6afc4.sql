-- SMTP Reputation and Health Monitoring System
-- This migration creates the foundation for production-ready SMTP protection

-- SMTP reputation tracking for domains and senders
CREATE TABLE smtp_reputation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  reputation_score INTEGER DEFAULT 100 CHECK (reputation_score >= 0 AND reputation_score <= 100),
  bounce_rate NUMERIC(5,2) DEFAULT 0 CHECK (bounce_rate >= 0 AND bounce_rate <= 100),
  complaint_rate NUMERIC(5,2) DEFAULT 0 CHECK (complaint_rate >= 0 AND complaint_rate <= 100),
  total_sent INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_complaints INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'healthy' CHECK (status IN ('healthy', 'warning', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SMTP provider configuration for multi-provider failover
CREATE TABLE smtp_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  host TEXT NOT NULL,
  port INTEGER NOT NULL CHECK (port > 0 AND port <= 65535),
  username TEXT,
  password_encrypted TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  daily_limit INTEGER DEFAULT 1000 CHECK (daily_limit > 0),
  hourly_limit INTEGER DEFAULT 100 CHECK (hourly_limit > 0),
  priority INTEGER DEFAULT 1 CHECK (priority > 0),
  health_score INTEGER DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
  last_health_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  failure_count INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0,
  last_failure_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced bounce and complaint tracking
CREATE TABLE email_bounce_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address TEXT NOT NULL,
  bounce_type TEXT NOT NULL CHECK (bounce_type IN ('hard', 'soft', 'complaint', 'unsubscribe')),
  bounce_reason TEXT,
  smtp_provider TEXT,
  bounce_count INTEGER DEFAULT 1,
  first_bounce_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_bounce_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  suppressed_at TIMESTAMP WITH TIME ZONE,
  suppression_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email_address, bounce_type)
);

-- Real-time SMTP health monitoring
CREATE TABLE smtp_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('connection_time', 'send_time', 'bounce_rate', 'complaint_rate', 'throughput', 'error_rate')),
  metric_value NUMERIC NOT NULL,
  threshold_value NUMERIC,
  threshold_breached BOOLEAN DEFAULT false,
  alert_sent BOOLEAN DEFAULT false,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Advanced rate limiting with reputation tiers
CREATE TABLE smtp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- email domain or specific email
  identifier_type TEXT DEFAULT 'domain' CHECK (identifier_type IN ('email', 'domain', 'ip')),
  reputation_tier TEXT DEFAULT 'new' CHECK (reputation_tier IN ('new', 'bronze', 'silver', 'gold', 'platinum')),
  hourly_limit INTEGER NOT NULL,
  daily_limit INTEGER NOT NULL,
  current_hour_count INTEGER DEFAULT 0,
  current_day_count INTEGER DEFAULT 0,
  window_reset_at TIMESTAMP WITH TIME ZONE DEFAULT DATE_TRUNC('hour', NOW() + INTERVAL '1 hour'),
  day_reset_at TIMESTAMP WITH TIME ZONE DEFAULT DATE_TRUNC('day', NOW() + INTERVAL '1 day'),
  last_send_at TIMESTAMP WITH TIME ZONE,
  violation_count INTEGER DEFAULT 0,
  last_violation_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(identifier, identifier_type)
);

-- SMTP connection audit log for security
CREATE TABLE smtp_connection_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL,
  connection_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  connection_success BOOLEAN NOT NULL,
  connection_time_ms INTEGER,
  error_message TEXT,
  source_ip INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email delivery confirmations tracking
CREATE TABLE smtp_delivery_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  provider_used TEXT NOT NULL,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('sent', 'delivered', 'bounced', 'complained', 'failed')),
  delivery_time_ms INTEGER,
  message_id TEXT,
  provider_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_smtp_reputation_domain ON smtp_reputation_scores(domain);
CREATE INDEX idx_smtp_reputation_status ON smtp_reputation_scores(status);
CREATE INDEX idx_smtp_providers_active ON smtp_provider_configs(is_active, priority);
CREATE INDEX idx_smtp_providers_health ON smtp_provider_configs(health_score DESC);
CREATE INDEX idx_bounce_tracking_email ON email_bounce_tracking(email_address);
CREATE INDEX idx_bounce_tracking_type ON email_bounce_tracking(bounce_type);
CREATE INDEX idx_bounce_tracking_suppressed ON email_bounce_tracking(suppressed_at) WHERE suppressed_at IS NOT NULL;
CREATE INDEX idx_health_metrics_provider ON smtp_health_metrics(provider_name, recorded_at DESC);
CREATE INDEX idx_health_metrics_breached ON smtp_health_metrics(threshold_breached, recorded_at DESC) WHERE threshold_breached = true;
CREATE INDEX idx_rate_limits_identifier ON smtp_rate_limits(identifier, identifier_type);
CREATE INDEX idx_rate_limits_tier ON smtp_rate_limits(reputation_tier);
CREATE INDEX idx_connection_audit_provider ON smtp_connection_audit(provider_name, created_at DESC);
CREATE INDEX idx_delivery_confirmations_email ON smtp_delivery_confirmations(email_id);
CREATE INDEX idx_delivery_confirmations_status ON smtp_delivery_confirmations(delivery_status, created_at DESC);

-- Enable RLS on all tables
ALTER TABLE smtp_reputation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_bounce_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_connection_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_delivery_confirmations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin access and service role operations
CREATE POLICY "Admins can manage SMTP reputation" ON smtp_reputation_scores
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Service roles can manage SMTP reputation" ON smtp_reputation_scores
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can manage SMTP providers" ON smtp_provider_configs
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Service roles can manage SMTP providers" ON smtp_provider_configs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view bounce tracking" ON email_bounce_tracking
  FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can manage bounce tracking" ON email_bounce_tracking
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view health metrics" ON smtp_health_metrics
  FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can manage health metrics" ON smtp_health_metrics
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service roles can manage rate limits" ON smtp_rate_limits
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view rate limits" ON smtp_rate_limits
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can view connection audit" ON smtp_connection_audit
  FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can insert connection audit" ON smtp_connection_audit
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view delivery confirmations" ON smtp_delivery_confirmations
  FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can manage delivery confirmations" ON smtp_delivery_confirmations
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Database functions for SMTP management
CREATE OR REPLACE FUNCTION calculate_sender_reputation(p_domain TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_sent INTEGER := 0;
  v_total_bounced INTEGER := 0;
  v_total_complaints INTEGER := 0;
  v_bounce_rate NUMERIC := 0;
  v_complaint_rate NUMERIC := 0;
  v_reputation_score INTEGER := 100;
  v_status TEXT := 'healthy';
BEGIN
  -- Get bounce statistics for the domain
  SELECT 
    COALESCE(SUM(bounce_count), 0) INTO v_total_bounced
  FROM email_bounce_tracking 
  WHERE email_address LIKE '%@' || p_domain 
    AND bounce_type IN ('hard', 'soft');

  SELECT 
    COALESCE(SUM(bounce_count), 0) INTO v_total_complaints
  FROM email_bounce_tracking 
  WHERE email_address LIKE '%@' || p_domain 
    AND bounce_type = 'complaint';

  -- Get total sent from communication events (approximate)
  SELECT COUNT(*) INTO v_total_sent
  FROM communication_events 
  WHERE recipient_email LIKE '%@' || p_domain;

  -- Calculate rates
  IF v_total_sent > 0 THEN
    v_bounce_rate := (v_total_bounced::NUMERIC / v_total_sent) * 100;
    v_complaint_rate := (v_total_complaints::NUMERIC / v_total_sent) * 100;
  END IF;

  -- Calculate reputation score
  v_reputation_score := 100;
  
  -- Deduct points for high bounce rate
  IF v_bounce_rate > 10 THEN
    v_reputation_score := v_reputation_score - 50;
  ELSIF v_bounce_rate > 5 THEN
    v_reputation_score := v_reputation_score - 30;
  ELSIF v_bounce_rate > 2 THEN
    v_reputation_score := v_reputation_score - 15;
  END IF;

  -- Deduct points for complaints
  IF v_complaint_rate > 0.5 THEN
    v_reputation_score := v_reputation_score - 40;
  ELSIF v_complaint_rate > 0.1 THEN
    v_reputation_score := v_reputation_score - 20;
  ELSIF v_complaint_rate > 0.05 THEN
    v_reputation_score := v_reputation_score - 10;
  END IF;

  -- Determine status
  IF v_bounce_rate > 10 OR v_complaint_rate > 0.5 THEN
    v_status := 'suspended';
  ELSIF v_bounce_rate > 5 OR v_complaint_rate > 0.1 THEN
    v_status := 'warning';
  END IF;

  -- Ensure minimum score is 0
  v_reputation_score := GREATEST(v_reputation_score, 0);

  -- Update or insert reputation score
  INSERT INTO smtp_reputation_scores (
    domain, reputation_score, bounce_rate, complaint_rate,
    total_sent, total_bounced, total_complaints, status
  ) VALUES (
    p_domain, v_reputation_score, v_bounce_rate, v_complaint_rate,
    v_total_sent, v_total_bounced, v_total_complaints, v_status
  ) ON CONFLICT (domain) DO UPDATE SET
    reputation_score = EXCLUDED.reputation_score,
    bounce_rate = EXCLUDED.bounce_rate,
    complaint_rate = EXCLUDED.complaint_rate,
    total_sent = EXCLUDED.total_sent,
    total_bounced = EXCLUDED.total_bounced,
    total_complaints = EXCLUDED.total_complaints,
    status = EXCLUDED.status,
    last_updated = NOW();

  RETURN jsonb_build_object(
    'domain', p_domain,
    'reputation_score', v_reputation_score,
    'bounce_rate', v_bounce_rate,
    'complaint_rate', v_complaint_rate,
    'status', v_status,
    'total_sent', v_total_sent
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_best_smtp_provider()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_provider RECORD;
BEGIN
  -- Get the best available SMTP provider based on health score and priority
  SELECT * INTO v_provider
  FROM smtp_provider_configs
  WHERE is_active = true
    AND health_score > 50  -- Minimum health threshold
  ORDER BY is_primary DESC, health_score DESC, priority ASC
  LIMIT 1;

  IF v_provider IS NULL THEN
    RETURN jsonb_build_object('error', 'No healthy SMTP providers available');
  END IF;

  RETURN jsonb_build_object(
    'id', v_provider.id,
    'name', v_provider.name,
    'host', v_provider.host,
    'port', v_provider.port,
    'health_score', v_provider.health_score
  );
END;
$$;

CREATE OR REPLACE FUNCTION check_rate_limit_with_reputation(
  p_identifier TEXT,
  p_identifier_type TEXT DEFAULT 'domain'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit_record RECORD;
  v_tier_limits JSONB;
  v_current_hour TIMESTAMP WITH TIME ZONE;
  v_current_day TIMESTAMP WITH TIME ZONE;
  v_allowed BOOLEAN := true;
  v_reason TEXT := '';
BEGIN
  v_current_hour := DATE_TRUNC('hour', NOW());
  v_current_day := DATE_TRUNC('day', NOW());

  -- Define tier limits
  v_tier_limits := jsonb_build_object(
    'new', jsonb_build_object('hourly', 10, 'daily', 50),
    'bronze', jsonb_build_object('hourly', 50, 'daily', 200),
    'silver', jsonb_build_object('hourly', 100, 'daily', 500),
    'gold', jsonb_build_object('hourly', 250, 'daily', 1000),
    'platinum', jsonb_build_object('hourly', 500, 'daily', 2000)
  );

  -- Get or create rate limit record
  SELECT * INTO v_limit_record
  FROM smtp_rate_limits
  WHERE identifier = p_identifier AND identifier_type = p_identifier_type;

  IF v_limit_record IS NULL THEN
    -- Create new record with 'new' tier
    INSERT INTO smtp_rate_limits (
      identifier, identifier_type, reputation_tier,
      hourly_limit, daily_limit, current_hour_count, current_day_count,
      window_reset_at, day_reset_at
    ) VALUES (
      p_identifier, p_identifier_type, 'new',
      (v_tier_limits->'new'->>'hourly')::INTEGER,
      (v_tier_limits->'new'->>'daily')::INTEGER,
      0, 0, v_current_hour + INTERVAL '1 hour', v_current_day + INTERVAL '1 day'
    ) RETURNING * INTO v_limit_record;
  END IF;

  -- Reset counters if windows have passed
  IF v_limit_record.window_reset_at <= NOW() THEN
    UPDATE smtp_rate_limits
    SET current_hour_count = 0,
        window_reset_at = v_current_hour + INTERVAL '1 hour'
    WHERE id = v_limit_record.id;
    v_limit_record.current_hour_count := 0;
  END IF;

  IF v_limit_record.day_reset_at <= NOW() THEN
    UPDATE smtp_rate_limits
    SET current_day_count = 0,
        day_reset_at = v_current_day + INTERVAL '1 day'
    WHERE id = v_limit_record.id;
    v_limit_record.current_day_count := 0;
  END IF;

  -- Check limits
  IF v_limit_record.current_hour_count >= v_limit_record.hourly_limit THEN
    v_allowed := false;
    v_reason := 'Hourly limit exceeded';
  ELSIF v_limit_record.current_day_count >= v_limit_record.daily_limit THEN
    v_allowed := false;
    v_reason := 'Daily limit exceeded';
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'reason', v_reason,
    'current_hour_count', v_limit_record.current_hour_count,
    'hourly_limit', v_limit_record.hourly_limit,
    'current_day_count', v_limit_record.current_day_count,
    'daily_limit', v_limit_record.daily_limit,
    'reputation_tier', v_limit_record.reputation_tier
  );
END;
$$;

-- Function to update rate limit after successful send
CREATE OR REPLACE FUNCTION increment_rate_limit_counter(
  p_identifier TEXT,
  p_identifier_type TEXT DEFAULT 'domain'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE smtp_rate_limits
  SET current_hour_count = current_hour_count + 1,
      current_day_count = current_day_count + 1,
      last_send_at = NOW(),
      updated_at = NOW()
  WHERE identifier = p_identifier AND identifier_type = p_identifier_type;
END;
$$;

-- Function to record SMTP health metrics
CREATE OR REPLACE FUNCTION record_smtp_health_metric(
  p_provider_name TEXT,
  p_metric_type TEXT,
  p_metric_value NUMERIC,
  p_threshold_value NUMERIC DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_threshold_breached BOOLEAN := false;
BEGIN
  -- Check if threshold is breached
  IF p_threshold_value IS NOT NULL THEN
    CASE p_metric_type
      WHEN 'bounce_rate', 'complaint_rate', 'error_rate' THEN
        v_threshold_breached := p_metric_value > p_threshold_value;
      WHEN 'connection_time', 'send_time' THEN
        v_threshold_breached := p_metric_value > p_threshold_value;
      ELSE
        v_threshold_breached := false;
    END CASE;
  END IF;

  -- Insert metric
  INSERT INTO smtp_health_metrics (
    provider_name, metric_type, metric_value, threshold_value, threshold_breached
  ) VALUES (
    p_provider_name, p_metric_type, p_metric_value, p_threshold_value, v_threshold_breached
  );

  -- Update provider health score if threshold breached
  IF v_threshold_breached THEN
    UPDATE smtp_provider_configs
    SET health_score = GREATEST(health_score - 10, 0),
        consecutive_failures = consecutive_failures + 1,
        last_failure_at = NOW()
    WHERE name = p_provider_name;
  ELSE
    -- Gradually recover health score
    UPDATE smtp_provider_configs
    SET health_score = LEAST(health_score + 1, 100),
        consecutive_failures = 0
    WHERE name = p_provider_name;
  END IF;
END;
$$;

-- Trigger to update reputation scores when bounces are recorded
CREATE OR REPLACE FUNCTION trigger_update_reputation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_domain TEXT;
BEGIN
  -- Extract domain from email
  v_domain := split_part(NEW.email_address, '@', 2);
  
  -- Update reputation score for the domain
  PERFORM calculate_sender_reputation(v_domain);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_reputation_on_bounce
  AFTER INSERT OR UPDATE ON email_bounce_tracking
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_reputation();

-- Trigger to update timestamps
CREATE TRIGGER update_smtp_providers_timestamp
  BEFORE UPDATE ON smtp_provider_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limits_timestamp
  BEFORE UPDATE ON smtp_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();