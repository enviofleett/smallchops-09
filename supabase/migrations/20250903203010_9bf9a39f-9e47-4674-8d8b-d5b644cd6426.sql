-- Clean up invalid queue items with NULL recipient_email
UPDATE communication_events 
SET 
  status = 'failed',
  error_message = 'Invalid recipient email - marked as failed during system cleanup',
  retry_count = 3,
  updated_at = NOW()
WHERE status = 'queued' 
  AND (recipient_email IS NULL OR recipient_email = '' OR TRIM(recipient_email) = '');

-- Clean up invalid queue items with NULL template_key
UPDATE communication_events 
SET 
  status = 'failed',
  error_message = 'Invalid template key - marked as failed during system cleanup',
  retry_count = 3,
  updated_at = NOW()
WHERE status = 'queued' 
  AND (template_key IS NULL OR template_key = '' OR TRIM(template_key) = '');

-- Log the cleanup action
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'email_queue_cleaned',
  'Email System',
  'Cleaned invalid queued email items during system maintenance',
  jsonb_build_object(
    'timestamp', NOW(),
    'action_type', 'queue_cleanup',
    'reason', 'invalid_recipient_or_template'
  )
);