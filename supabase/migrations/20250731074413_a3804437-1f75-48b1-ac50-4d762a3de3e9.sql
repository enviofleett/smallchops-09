-- Fix SMTP configuration for production email delivery
UPDATE communication_settings 
SET 
  smtp_port = 465,
  smtp_secure = true,
  updated_at = NOW()
WHERE id = '79f99cc9-33c7-440e-ba60-d23acadd1bf6';