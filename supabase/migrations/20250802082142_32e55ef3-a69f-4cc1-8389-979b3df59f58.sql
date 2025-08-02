-- Emergency Fix: Reset failed emails and restart email processing
UPDATE communication_events 
SET 
  status = 'queued',
  retry_count = 0,
  error_message = NULL,
  last_error = NULL,
  processed_at = NULL,
  updated_at = NOW()
WHERE status = 'failed' AND retry_count >= 3;

-- Log the emergency fix
INSERT INTO audit_logs (action, category, message, new_values) 
VALUES (
  'emergency_email_fix', 
  'System Maintenance', 
  'Reset all failed emails to queued status and fixed server-side JavaScript errors',
  jsonb_build_object(
    'reset_emails', (SELECT COUNT(*) FROM communication_events WHERE status = 'queued'),
    'fixed_issues', ARRAY['window.location.origin error', 'event type mapping', 'failed email reset']
  )
);