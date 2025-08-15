-- Queue welcome emails for verified users who didn't receive them
INSERT INTO communication_events (
  event_type,
  recipient_email,
  template_key,
  status,
  variables,
  created_at
)
SELECT 
  'customer_welcome',
  ca.email,
  'customer_welcome',
  'queued',
  jsonb_build_object(
    'customer_name', ca.name,
    'customer_email', ca.email
  ),
  NOW()
FROM customer_accounts ca
WHERE ca.email_verified = true
  AND NOT EXISTS (
    SELECT 1 FROM communication_events ce 
    WHERE ce.recipient_email = ca.email 
    AND ce.event_type = 'customer_welcome'
  );