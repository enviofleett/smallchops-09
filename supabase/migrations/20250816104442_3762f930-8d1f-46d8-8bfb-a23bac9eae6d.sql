-- Create email automation tables

-- Email automation queue table
CREATE TABLE IF NOT EXISTS email_automation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id TEXT NOT NULL,
  action_index INTEGER NOT NULL DEFAULT 0,
  trigger_data JSONB NOT NULL DEFAULT '{}',
  execute_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'completed', 'failed')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email automation logs
CREATE TABLE IF NOT EXISTS email_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  flow_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  variables JSONB DEFAULT '{}',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email trigger logs
CREATE TABLE IF NOT EXISTS email_trigger_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  trigger_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'processed',
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Automation activity logs
CREATE TABLE IF NOT EXISTS automation_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  status TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email automation errors
CREATE TABLE IF NOT EXISTS email_automation_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id TEXT NOT NULL,
  action_index INTEGER NOT NULL,
  trigger_data JSONB NOT NULL DEFAULT '{}',
  error_message TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email batch processing logs
CREATE TABLE IF NOT EXISTS email_batch_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority TEXT NOT NULL CHECK (priority IN ('high', 'normal', 'low')),
  total_processed INTEGER NOT NULL DEFAULT 0,
  successful INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email delivery logs (enhanced)
CREATE TABLE IF NOT EXISTS email_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_event_id UUID,
  recipient_email TEXT NOT NULL,
  template_key TEXT NOT NULL,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('delivered', 'failed', 'bounced', 'complained')),
  provider TEXT,
  processing_time_ms INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email dead letter queue
CREATE TABLE IF NOT EXISTS email_dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_communication_event_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  template_key TEXT NOT NULL,
  variables JSONB DEFAULT '{}',
  final_error TEXT NOT NULL,
  total_attempts INTEGER NOT NULL,
  moved_to_dlq_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT
);

-- Email system health logs
CREATE TABLE IF NOT EXISTS email_system_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_stats JSONB NOT NULL DEFAULT '{}',
  stuck_emails_found INTEGER DEFAULT 0,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to communication_events if they don't exist
ALTER TABLE communication_events 
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Add missing columns to customer_accounts
ALTER TABLE customer_accounts 
ADD COLUMN IF NOT EXISTS last_order_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS reactivation_email_sent TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_automation_queue_execute_at ON email_automation_queue(execute_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_email_automation_queue_status ON email_automation_queue(status);
CREATE INDEX IF NOT EXISTS idx_communication_events_priority_status ON communication_events(priority, status);
CREATE INDEX IF NOT EXISTS idx_communication_events_scheduled_at ON communication_events(scheduled_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_recipient ON email_delivery_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_last_order ON customer_accounts(last_order_date);

-- Email rate limiting function
CREATE OR REPLACE FUNCTION check_email_rate_limit(email_address TEXT, time_window_minutes INTEGER DEFAULT 60)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  email_count INTEGER;
  hourly_limit INTEGER := 10; -- Max 10 emails per hour per address
BEGIN
  -- Count emails sent to this address in the time window
  SELECT COUNT(*) INTO email_count
  FROM communication_events
  WHERE recipient_email = email_address
    AND status = 'sent'
    AND sent_at > NOW() - (time_window_minutes || ' minutes')::INTERVAL;
  
  RETURN jsonb_build_object(
    'allowed', email_count < hourly_limit,
    'current_count', email_count,
    'limit', hourly_limit,
    'reset_at', NOW() + (time_window_minutes || ' minutes')::INTERVAL
  );
END;
$$;

-- Email rate limit increment function
CREATE OR REPLACE FUNCTION increment_email_rate_limit(email_address TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- This function could be used to track rate limits in a dedicated table
  -- For now, we rely on the communication_events table
  NULL;
END;
$$;

-- Email suppression check function (enhanced)
CREATE OR REPLACE FUNCTION is_email_suppressed(email_address TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check email_suppression_list table
  IF EXISTS (
    SELECT 1 FROM email_suppression_list 
    WHERE email = LOWER(email_address) 
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;
  
  -- Check email_bounce_tracking for hard bounces
  IF EXISTS (
    SELECT 1 FROM email_bounce_tracking 
    WHERE email_address = LOWER(email_address)
    AND bounce_type = 'hard'
    AND suppressed_at IS NOT NULL
  ) THEN
    RETURN true;
  END IF;
  
  -- Check unsubscribe status
  IF EXISTS (
    SELECT 1 FROM email_unsubscribes 
    WHERE email = LOWER(email_address)
    AND unsubscribed_at IS NOT NULL
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Create RLS policies for automation tables
ALTER TABLE email_automation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_trigger_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_automation_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_batch_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_system_health_logs ENABLE ROW LEVEL SECURITY;

-- Admin access policies
CREATE POLICY "Admins can manage email automation queue" ON email_automation_queue FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can view automation logs" ON email_automation_logs FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins can view trigger logs" ON email_trigger_logs FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins can view activity logs" ON automation_activity_logs FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins can manage automation errors" ON email_automation_errors FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can view batch logs" ON email_batch_logs FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins can view delivery logs" ON email_delivery_logs FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admins can manage dead letter queue" ON email_dead_letter_queue FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can view health logs" ON email_system_health_logs FOR SELECT TO authenticated USING (is_admin());

-- Service role policies
CREATE POLICY "Service roles can manage email automation" ON email_automation_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service roles can insert automation logs" ON email_automation_logs FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service roles can insert trigger logs" ON email_trigger_logs FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service roles can insert activity logs" ON automation_activity_logs FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service roles can manage automation errors" ON email_automation_errors FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service roles can insert batch logs" ON email_batch_logs FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service roles can insert delivery logs" ON email_delivery_logs FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service roles can manage dead letter queue" ON email_dead_letter_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service roles can insert health logs" ON email_system_health_logs FOR INSERT TO service_role WITH CHECK (true);