-- Remove all MailerSend-related environment variable requirements and references

-- Update production audit fix to remove MailerSend token requirement
UPDATE production_audit_fix SET 
  required_env_vars = jsonb_build_array('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY')
WHERE required_env_vars @> '["MAILERSEND_API_TOKEN"]';

-- Clean up any remaining MailerSend columns that weren't properly removed
ALTER TABLE public.communication_settings 
DROP COLUMN IF EXISTS mailersend_api_token,
DROP COLUMN IF EXISTS mailersend_domain,
DROP COLUMN IF EXISTS mailersend_domain_verified;

-- Add comment to document migration to SMTP-only
COMMENT ON TABLE public.communication_settings IS 'Communication settings for SMTP-only email delivery. MailerSend integration has been removed in favor of direct SMTP configuration.';