-- Add missing email_id column to smtp_delivery_logs table
ALTER TABLE smtp_delivery_logs ADD COLUMN IF NOT EXISTS email_id VARCHAR;

-- Update communication_settings to use correct SMTP configuration for smtp.yournotify.com
-- This ensures STARTTLS is used instead of direct SSL for port 587
UPDATE communication_settings 
SET 
  smtp_host = 'smtp.yournotify.com',
  smtp_port = 587,
  smtp_secure = false,  -- Use STARTTLS for port 587, not direct SSL
  smtp_user = 'store@startersmallchops.com',
  sender_email = 'store@startersmallchops.com',
  sender_name = 'Starters Small Chops'
WHERE smtp_host IS NULL OR smtp_host = '';

-- Insert default SMTP configuration if no records exist
INSERT INTO communication_settings (
  smtp_host,
  smtp_port,
  smtp_user,
  smtp_secure,
  sender_email,
  sender_name,
  use_smtp
)
SELECT 
  'smtp.yournotify.com',
  587,
  'store@startersmallchops.com',
  false,  -- STARTTLS for port 587
  'store@startersmallchops.com',
  'Starters Small Chops',
  true
WHERE NOT EXISTS (SELECT 1 FROM communication_settings);