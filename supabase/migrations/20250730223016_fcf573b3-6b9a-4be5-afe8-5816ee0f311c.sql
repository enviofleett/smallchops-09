-- Add missing smtp_secure column to communication_settings table
ALTER TABLE communication_settings 
ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT TRUE;