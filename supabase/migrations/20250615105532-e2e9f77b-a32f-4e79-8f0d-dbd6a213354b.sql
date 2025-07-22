
ALTER TABLE public.communication_settings
DROP COLUMN IF EXISTS email_provider,
DROP COLUMN IF EXISTS email_api_key;
