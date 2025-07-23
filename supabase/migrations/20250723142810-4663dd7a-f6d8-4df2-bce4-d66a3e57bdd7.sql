-- Add MailerSend specific configuration to communication_settings table
ALTER TABLE public.communication_settings 
ADD COLUMN IF NOT EXISTS mailersend_api_token text,
ADD COLUMN IF NOT EXISTS mailersend_domain text,
ADD COLUMN IF NOT EXISTS mailersend_domain_verified boolean DEFAULT false;