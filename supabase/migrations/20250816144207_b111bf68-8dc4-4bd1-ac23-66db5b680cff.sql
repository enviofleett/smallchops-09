-- Create CRON execution tracking table
CREATE TABLE IF NOT EXISTS cron_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  duration_ms INTEGER,
  result_data JSONB,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_cron_execution_logs_task_started ON cron_execution_logs(task_name, started_at);
CREATE INDEX IF NOT EXISTS idx_cron_execution_logs_status ON cron_execution_logs(status);

-- RLS for CRON logs
ALTER TABLE cron_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view CRON logs" ON cron_execution_logs FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Service roles can manage CRON logs" ON cron_execution_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Setup CRON jobs for email automation
-- Note: These will need to be run manually in the Supabase SQL editor with proper extensions enabled

-- Process email queue every 5 minutes
SELECT cron.schedule(
  'email-queue-processing',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/email-cron-automation',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{"action": "execute_task", "taskName": "email_queue_processing"}'::jsonb
  );
  $$
);

-- Process automation queue every 2 minutes
SELECT cron.schedule(
  'automation-queue-processing',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/email-cron-automation',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{"action": "execute_task", "taskName": "automation_queue_processing"}'::jsonb
  );
  $$
);

-- Detect cart abandonments every hour
SELECT cron.schedule(
  'cart-abandonment-detection',
  '0 */1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/email-cron-automation',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{"action": "execute_task", "taskName": "cart_abandonment_detection"}'::jsonb
  );
  $$
);

-- Detect inactive customers daily at 8 AM
SELECT cron.schedule(
  'inactive-customer-detection',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/email-cron-automation',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{"action": "execute_task", "taskName": "inactive_customer_detection"}'::jsonb
  );
  $$
);

-- Health check every 10 minutes
SELECT cron.schedule(
  'email-system-health',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/email-cron-automation',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{"action": "execute_task", "taskName": "email_system_health"}'::jsonb
  );
  $$
);

-- Daily cleanup at 2 AM
SELECT cron.schedule(
  'email-system-cleanup',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/email-cron-automation',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{"action": "execute_task", "taskName": "email_cleanup"}'::jsonb
  );
  $$
);

-- Process bounces every 15 minutes
SELECT cron.schedule(
  'bounce-processing',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/email-cron-automation',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{"action": "execute_task", "taskName": "bounce_processing"}'::jsonb
  );
  $$
);

-- Weekly digest on Monday at 9 AM
SELECT cron.schedule(
  'weekly-email-digest',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/email-cron-automation',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{"action": "execute_task", "taskName": "weekly_digest"}'::jsonb
  );
  $$
);