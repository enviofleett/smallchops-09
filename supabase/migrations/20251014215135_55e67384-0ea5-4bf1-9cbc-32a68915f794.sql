-- URGENT FIX: Stop email flood by fixing smtp_delivery_logs constraints and clearing failed queue

-- 1. Fix the provider check constraint to allow 'native-smtp'
ALTER TABLE smtp_delivery_logs 
DROP CONSTRAINT IF EXISTS smtp_delivery_logs_provider_check;

ALTER TABLE smtp_delivery_logs 
ADD CONSTRAINT smtp_delivery_logs_provider_check 
CHECK (provider = ANY (ARRAY['smtp'::text, 'mailersend'::text, 'native-smtp'::text, 'gmail'::text]));

-- 2. Archive all queued emails to stop the processing loop
INSERT INTO communication_events_archive (
  id, event_type, recipient_email, template_key, template_variables,
  status, retry_count, error_message, created_at, updated_at,
  order_id, priority, email_provider
)
SELECT 
  id, event_type, recipient_email, template_key, template_variables,
  'failed'::communication_event_status as status, 
  retry_count, 
  'Archived during email flood emergency fix - Oct 14 2025' as error_message,
  created_at, NOW() as updated_at,
  order_id, priority, email_provider
FROM communication_events
WHERE status = 'queued'
AND created_at < NOW() - INTERVAL '5 minutes';

-- 3. Delete the archived events from main table
DELETE FROM communication_events
WHERE status = 'queued'
AND created_at < NOW() - INTERVAL '5 minutes';

-- 4. Add audit log
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'email_flood_emergency_fix',
  'Email System',
  'Fixed smtp_delivery_logs constraint and archived queued emails to stop email flood',
  jsonb_build_object(
    'archived_count', (SELECT COUNT(*) FROM communication_events_archive WHERE error_message LIKE '%email flood emergency fix%'),
    'constraint_fixed', 'smtp_delivery_logs_provider_check now allows native-smtp',
    'timestamp', NOW()
  )
);