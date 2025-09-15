-- Update SMTP configuration to use Gmail
UPDATE communication_settings 
SET 
  smtp_host = 'smtp.gmail.com',
  smtp_port = 587,
  smtp_secure = true,
  updated_at = now()
WHERE use_smtp = true;

-- Log the SMTP configuration update
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'smtp_configuration_updated',
  'Email System',
  'Updated SMTP configuration to use Gmail (smtp.gmail.com)',
  jsonb_build_object(
    'old_host', 'smtp.yournotify.com',
    'new_host', 'smtp.gmail.com',
    'port', 587,
    'secure', true,
    'timestamp', now()
  )
);