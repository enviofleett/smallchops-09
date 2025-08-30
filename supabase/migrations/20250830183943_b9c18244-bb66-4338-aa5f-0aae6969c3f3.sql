-- Update SMTP settings with correct YourNotify credentials
UPDATE communication_settings 
SET 
  smtp_host = 'smtp.yournotify.com',
  smtp_port = 587,
  smtp_user = 'store@startersmallchops.com',
  smtp_pass = 'EVi4fbDA18',
  smtp_secure = false, -- TLS on port 587 (STARTTLS)
  sender_email = 'store@startersmallchops.com',
  sender_name = 'Starters Small Chops',
  use_smtp = true,
  updated_at = NOW()
WHERE id = (SELECT id FROM communication_settings ORDER BY created_at DESC LIMIT 1);

-- If no settings exist, create them
INSERT INTO communication_settings (
  smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, 
  sender_email, sender_name, use_smtp, email_provider
) 
SELECT 
  'smtp.yournotify.com', 587, 'store@startersmallchops.com', 'EVi4fbDA18', false,
  'store@startersmallchops.com', 'Starters Small Chops', true, 'smtp'
WHERE NOT EXISTS (SELECT 1 FROM communication_settings);