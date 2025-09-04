-- Security enhancement: Clear any SMTP passwords from database to ensure Function Secrets are used in production
-- First check if smtp_pass column exists and clear it
UPDATE communication_settings 
SET smtp_pass = NULL, 
    updated_at = NOW()
WHERE smtp_pass IS NOT NULL;

-- Add audit log for this security action
INSERT INTO audit_logs (
  action,
  category, 
  message,
  new_values
) VALUES (
  'smtp_passwords_cleared',
  'Security',
  'SMTP passwords cleared from database to enforce Function Secrets usage in production',
  jsonb_build_object(
    'reason', 'security_hardening',
    'timestamp', NOW(),
    'cleared_count', (SELECT COUNT(*) FROM communication_settings WHERE smtp_pass IS NULL)
  )
);