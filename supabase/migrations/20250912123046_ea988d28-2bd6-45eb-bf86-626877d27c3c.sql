-- Schedule review request automation to run daily
-- This will process orders that are 7+ days old and delivered

SELECT cron.schedule(
  'review-request-automation',
  '0 10 * * *', -- Run daily at 10 AM
  $$
  SELECT net.http_post(
    url := 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/review-request-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzE5MDkxNCwiZXhwIjoyMDY4NzY2OTE0fQ.0Q8OzGGxQsEHPUGjJLyaWO5E1HHuGQ0WzUBjGH7mVSU"}'::jsonb,
    body := '{"trigger": "daily_automation", "timestamp": "' || now() || '"}'::jsonb
  ) as request_id;
  $$
);

-- Add documentation for cron jobs  
INSERT INTO audit_logs (
  action,
  category, 
  message,
  new_values
) VALUES (
  'cron_job_scheduled',
  'Email System',
  'Review request automation scheduled for daily execution at 10 AM',
  jsonb_build_object(
    'job_name', 'review-request-automation',
    'schedule', '0 10 * * *',
    'description', 'Processes delivered orders older than 7 days to send review request emails'
  )
);