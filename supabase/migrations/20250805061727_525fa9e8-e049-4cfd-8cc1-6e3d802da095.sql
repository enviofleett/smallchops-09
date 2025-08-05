-- Clean up any remaining MailerSend columns that weren't properly removed
ALTER TABLE public.communication_settings 
DROP COLUMN IF EXISTS mailersend_api_token,
DROP COLUMN IF EXISTS mailersend_domain,
DROP COLUMN IF EXISTS mailersend_domain_verified;

-- Add comment to document migration to SMTP-only
COMMENT ON TABLE public.communication_settings IS 'Communication settings for SMTP-only email delivery. MailerSend integration has been removed in favor of direct SMTP configuration.';