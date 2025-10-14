-- Clear legacy SMTP credentials from database (security improvement)
-- Forces production to use ONLY Function Secrets
UPDATE communication_settings 
SET 
  smtp_pass = NULL,
  credential_source = 'function_secrets',
  updated_at = NOW()
WHERE smtp_pass IS NOT NULL;

-- Add audit log for security tracking
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'legacy_smtp_credentials_removed',
  'Security',
  'Removed legacy database SMTP credentials in favor of Function Secrets',
  jsonb_build_object(
    'old_credential_source', 'database',
    'new_credential_source', 'function_secrets',
    'timestamp', NOW()
  )
);