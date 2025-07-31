-- Remove MailerSend related columns from communication_settings table
ALTER TABLE public.communication_settings 
DROP COLUMN IF EXISTS mailersend_api_token,
DROP COLUMN IF EXISTS mailersend_domain,
DROP COLUMN IF EXISTS mailersend_domain_verified,
DROP COLUMN IF EXISTS enable_email,
DROP COLUMN IF EXISTS enable_sms,
DROP COLUMN IF EXISTS sms_provider,
DROP COLUMN IF EXISTS sms_sender_id,
DROP COLUMN IF EXISTS sms_api_key;

-- Update existing records to set email_provider to 'smtp' if null
UPDATE public.communication_settings 
SET email_provider = 'smtp' 
WHERE email_provider IS NULL OR email_provider = 'mailersend';