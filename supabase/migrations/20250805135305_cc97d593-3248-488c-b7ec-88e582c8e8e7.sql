-- Trigger processing of queued emails by resetting their status
UPDATE communication_events 
SET status = 'queued'::communication_event_status,
    updated_at = NOW(),
    retry_count = 0
WHERE status = 'queued'::communication_event_status
AND template_key IS NOT NULL;

-- Log the email processing trigger
INSERT INTO audit_logs (action, category, message, new_values) 
VALUES (
  'trigger_email_processing',
  'Email System',
  'Triggered processing of queued emails after template key fix',
  jsonb_build_object('queued_emails_triggered', (SELECT COUNT(*) FROM communication_events WHERE status = 'queued'))
);