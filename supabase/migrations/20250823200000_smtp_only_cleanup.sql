-- Ensure SMTP-only email configuration
-- This migration removes any remaining third-party email provider support

-- Update communication_settings to enforce SMTP-only
UPDATE communication_settings 
SET 
  email_provider = 'smtp',
  use_smtp = true
WHERE email_provider != 'smtp' OR use_smtp = false;

-- Update the get_active_email_provider function to work with communication_settings SMTP config
-- This provides backward compatibility while ensuring SMTP-only operation
CREATE OR REPLACE FUNCTION public.get_active_email_provider()
RETURNS TABLE (
  provider_name text,
  provider_type text,
  host text,
  port integer,
  username text,
  use_tls boolean,
  health_score numeric
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    'smtp'::text as provider_name,
    'smtp'::text as provider_type,
    cs.smtp_host::text as host,
    cs.smtp_port::integer as port,
    cs.smtp_user::text as username,
    cs.smtp_secure::boolean as use_tls,
    80::numeric as health_score  -- Default healthy score for SMTP
  FROM communication_settings cs
  WHERE cs.use_smtp = true 
    AND cs.smtp_host IS NOT NULL 
    AND cs.smtp_user IS NOT NULL
  ORDER BY cs.updated_at DESC
  LIMIT 1;
$$;

-- Add a comment to document the SMTP-only approach
COMMENT ON FUNCTION public.get_active_email_provider() IS 'Returns active SMTP configuration. Third-party email providers have been removed in favor of direct SMTP integration.';

-- Ensure email_provider columns default to 'smtp'
ALTER TABLE communication_settings 
ALTER COLUMN email_provider SET DEFAULT 'smtp';

-- Update any existing email delivery logs to reflect SMTP provider
UPDATE email_delivery_logs 
SET provider = 'smtp' 
WHERE provider IS NULL OR provider IN ('mailersend', 'sendgrid', 'mailgun', 'resend');

-- Update communication events to use SMTP provider
UPDATE communication_events 
SET provider = 'smtp' 
WHERE provider IS NULL OR provider IN ('mailersend', 'sendgrid', 'mailgun', 'resend');