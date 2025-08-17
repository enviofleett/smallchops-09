-- Production Email System Security Hardening

-- 1. Enable RLS on all email-related tables that are missing it
ALTER TABLE communication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE enhanced_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_bounce_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_delivery_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- 2. Create comprehensive RLS policies for email tables

-- Communication Events - Admin only
CREATE POLICY "Admins can manage communication events" ON communication_events
  FOR ALL USING (is_admin());

-- Email Templates - Admin only for management, read-only for functions
CREATE POLICY "Admins can manage email templates" ON enhanced_email_templates
  FOR ALL USING (is_admin());

CREATE POLICY "Service role can read email templates" ON enhanced_email_templates
  FOR SELECT USING (auth.role() = 'service_role');

-- Communication Settings - Admin only
CREATE POLICY "Admins can manage communication settings" ON communication_settings
  FOR ALL USING (is_admin());

CREATE POLICY "Service role can read communication settings" ON communication_settings
  FOR SELECT USING (auth.role() = 'service_role');

-- Email Suppression - Admin read, service role can insert/update
CREATE POLICY "Admins can view email suppressions" ON email_suppression_list
  FOR SELECT USING (is_admin());

CREATE POLICY "Service role can manage email suppressions" ON email_suppression_list
  FOR ALL USING (auth.role() = 'service_role');

-- Email Bounce Tracking - Admin read, service role can insert/update
CREATE POLICY "Admins can view bounce tracking" ON email_bounce_tracking
  FOR SELECT USING (is_admin());

CREATE POLICY "Service role can manage bounce tracking" ON email_bounce_tracking
  FOR ALL USING (auth.role() = 'service_role');

-- SMTP Delivery Logs - Admin read, service role can insert
CREATE POLICY "Admins can view delivery logs" ON smtp_delivery_logs
  FOR SELECT USING (is_admin());

CREATE POLICY "Service role can create delivery logs" ON smtp_delivery_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- SMTP Delivery Confirmations - Admin read, service role can insert
CREATE POLICY "Admins can view delivery confirmations" ON smtp_delivery_confirmations
  FOR SELECT USING (is_admin());

CREATE POLICY "Service role can create delivery confirmations" ON smtp_delivery_confirmations
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Email Health Metrics - Admin read, service role can insert/update
CREATE POLICY "Admins can view health metrics" ON email_health_metrics
  FOR SELECT USING (is_admin());

CREATE POLICY "Service role can manage health metrics" ON email_health_metrics
  FOR ALL USING (auth.role() = 'service_role');

-- Email Unsubscribes - Admin read, anyone can insert their own
CREATE POLICY "Admins can view unsubscribes" ON email_unsubscribes
  FOR SELECT USING (is_admin());

CREATE POLICY "Anyone can unsubscribe" ON email_unsubscribes
  FOR INSERT WITH CHECK (true);

-- 3. Create secure email delivery logging function
CREATE OR REPLACE FUNCTION log_email_delivery(
  p_recipient_email TEXT,
  p_message_id TEXT,
  p_subject TEXT,
  p_delivery_status TEXT,
  p_smtp_response TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_sender_email TEXT DEFAULT NULL,
  p_provider TEXT DEFAULT 'smtp',
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO smtp_delivery_logs (
    message_id,
    recipient_email,
    subject,
    delivery_status,
    smtp_response,
    error_message,
    sender_email,
    provider,
    metadata,
    delivery_timestamp
  ) VALUES (
    p_message_id,
    p_recipient_email,
    p_subject,
    p_delivery_status,
    p_smtp_response,
    p_error_message,
    p_sender_email,
    p_provider,
    p_metadata,
    NOW()
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 4. Create email health scoring function
CREATE OR REPLACE FUNCTION calculate_email_health_score()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_delivery_rate NUMERIC;
  v_bounce_rate NUMERIC;
  v_complaint_rate NUMERIC;
  v_health_score NUMERIC;
BEGIN
  -- Calculate rates from last 24 hours
  WITH email_stats AS (
    SELECT 
      COUNT(*) as total_emails,
      COUNT(CASE WHEN delivery_status = 'delivered' THEN 1 END) as delivered,
      COUNT(CASE WHEN delivery_status = 'bounced' THEN 1 END) as bounced,
      COUNT(CASE WHEN delivery_status = 'complained' THEN 1 END) as complained
    FROM smtp_delivery_logs
    WHERE created_at > NOW() - INTERVAL '24 hours'
  )
  SELECT 
    CASE WHEN total_emails > 0 THEN (delivered::NUMERIC / total_emails) * 100 ELSE 100 END,
    CASE WHEN total_emails > 0 THEN (bounced::NUMERIC / total_emails) * 100 ELSE 0 END,
    CASE WHEN total_emails > 0 THEN (complained::NUMERIC / total_emails) * 100 ELSE 0 END
  INTO v_delivery_rate, v_bounce_rate, v_complaint_rate
  FROM email_stats;
  
  -- Calculate health score (0-100)
  v_health_score := GREATEST(0, 
    v_delivery_rate - (v_bounce_rate * 2) - (v_complaint_rate * 5)
  );
  
  RETURN v_health_score;
END;
$$;

-- 5. Create email suppression management function
CREATE OR REPLACE FUNCTION suppress_email_address(
  p_email TEXT,
  p_reason TEXT,
  p_bounce_type TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'manual'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert or update suppression record
  INSERT INTO email_suppression_list (
    email,
    reason,
    bounce_type,
    source,
    suppressed_at,
    is_active
  ) VALUES (
    LOWER(p_email),
    p_reason,
    p_bounce_type,
    p_source,
    NOW(),
    true
  )
  ON CONFLICT (email) DO UPDATE SET
    reason = EXCLUDED.reason,
    bounce_type = EXCLUDED.bounce_type,
    source = EXCLUDED.source,
    suppressed_at = NOW(),
    is_active = true;
    
  RETURN true;
END;
$$;

-- 6. Create automated email health monitoring
CREATE OR REPLACE FUNCTION monitor_email_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_health_score NUMERIC;
  v_issues TEXT[] := '{}';
  v_recommendations TEXT[] := '{}';
  v_delivery_rate NUMERIC;
  v_bounce_rate NUMERIC;
BEGIN
  v_health_score := calculate_email_health_score();
  
  -- Check delivery rate
  SELECT 
    CASE WHEN COUNT(*) > 0 THEN 
      (COUNT(CASE WHEN delivery_status = 'delivered' THEN 1 END)::NUMERIC / COUNT(*)) * 100 
    ELSE 100 END
  INTO v_delivery_rate
  FROM smtp_delivery_logs
  WHERE created_at > NOW() - INTERVAL '24 hours';
  
  -- Check bounce rate
  SELECT 
    CASE WHEN COUNT(*) > 0 THEN 
      (COUNT(CASE WHEN delivery_status = 'bounced' THEN 1 END)::NUMERIC / COUNT(*)) * 100 
    ELSE 0 END
  INTO v_bounce_rate
  FROM smtp_delivery_logs
  WHERE created_at > NOW() - INTERVAL '24 hours';
  
  -- Generate issues and recommendations
  IF v_delivery_rate < 95 THEN
    v_issues := array_append(v_issues, 'Low delivery rate: ' || v_delivery_rate::TEXT || '%');
    v_recommendations := array_append(v_recommendations, 'Review SMTP configuration and sender reputation');
  END IF;
  
  IF v_bounce_rate > 5 THEN
    v_issues := array_append(v_issues, 'High bounce rate: ' || v_bounce_rate::TEXT || '%');
    v_recommendations := array_append(v_recommendations, 'Clean email list and implement better validation');
  END IF;
  
  -- Record health metrics
  INSERT INTO email_health_metrics (
    metric_type,
    metric_value,
    health_score,
    issues,
    recommendations,
    recorded_at
  ) VALUES (
    'daily_health_check',
    jsonb_build_object(
      'delivery_rate', v_delivery_rate,
      'bounce_rate', v_bounce_rate,
      'health_score', v_health_score
    ),
    v_health_score,
    v_issues,
    v_recommendations,
    NOW()
  );
  
  RETURN jsonb_build_object(
    'health_score', v_health_score,
    'delivery_rate', v_delivery_rate,
    'bounce_rate', v_bounce_rate,
    'issues', v_issues,
    'recommendations', v_recommendations
  );
END;
$$;