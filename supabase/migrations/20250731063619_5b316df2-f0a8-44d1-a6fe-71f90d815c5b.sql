-- Phase 1: Add missing columns to communication_settings table
ALTER TABLE communication_settings 
ADD COLUMN IF NOT EXISTS email_provider TEXT DEFAULT 'mailersend',
ADD COLUMN IF NOT EXISTS use_smtp BOOLEAN DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_communication_settings_created_at 
ON communication_settings(created_at DESC);

-- Update existing records to have default values
UPDATE communication_settings 
SET 
  email_provider = COALESCE(email_provider, 'mailersend'),
  use_smtp = COALESCE(use_smtp, false),
  sender_name = COALESCE(sender_name, 'Email Service')
WHERE email_provider IS NULL OR use_smtp IS NULL;