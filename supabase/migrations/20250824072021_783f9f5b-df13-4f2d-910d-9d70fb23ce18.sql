-- Create missing rate_limit_counters table and fix security issues

-- Create rate_limit_counters table if it doesn't exist
CREATE TABLE IF NOT EXISTS rate_limit_counters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier text NOT NULL,
  count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT NOW(),
  window_size_minutes integer NOT NULL DEFAULT 60,
  reputation_score numeric DEFAULT 1.0,
  created_at timestamp with time zone DEFAULT NOW(),
  updated_at timestamp with time zone DEFAULT NOW()
);

-- Enable RLS on tables that exist and don't have it
ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_health_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_system_health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_batch_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_health_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for rate_limit_counters
CREATE POLICY "Service roles can manage rate limits" ON rate_limit_counters
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view rate limits" ON rate_limit_counters 
FOR SELECT USING (is_admin());

-- Create RLS policies for smtp_health_monitoring  
CREATE POLICY "Service roles can manage SMTP health monitoring" ON smtp_health_monitoring
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view SMTP health monitoring" ON smtp_health_monitoring
FOR SELECT USING (is_admin());

-- Create RLS policies for email_system_health_logs
CREATE POLICY "Service roles can manage email system health logs" ON email_system_health_logs
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view email system health logs" ON email_system_health_logs
FOR SELECT USING (is_admin());

-- Create RLS policies for email_dead_letter_queue
CREATE POLICY "Service roles can manage dead letter queue" ON email_dead_letter_queue
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view dead letter queue" ON email_dead_letter_queue
FOR SELECT USING (is_admin());

-- Create RLS policies for email_processing_queue
CREATE POLICY "Service roles can manage processing queue" ON email_processing_queue
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view processing queue" ON email_processing_queue
FOR SELECT USING (is_admin());

-- Create RLS policies for email_batch_logs
CREATE POLICY "Service roles can manage batch logs" ON email_batch_logs
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view batch logs" ON email_batch_logs
FOR SELECT USING (is_admin());

-- Create RLS policies for smtp_health_logs
CREATE POLICY "Service roles can manage SMTP health logs" ON smtp_health_logs
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view SMTP health logs" ON smtp_health_logs
FOR SELECT USING (is_admin());