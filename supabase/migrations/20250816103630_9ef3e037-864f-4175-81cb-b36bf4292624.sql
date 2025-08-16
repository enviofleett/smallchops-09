-- Fix SMTP authentication data in communication_settings
UPDATE communication_settings 
SET 
  smtp_host = 'mail.startersmallchops.com',
  smtp_port = 587,
  smtp_user = 'store@startersmallchops.com',
  smtp_pass = 'StartersSmallChops2024!',
  smtp_secure = false,
  sender_email = 'store@startersmallchops.com',
  sender_name = 'Starters Small Chops',
  use_smtp = true,
  updated_at = NOW()
WHERE id = (SELECT id FROM communication_settings ORDER BY updated_at DESC LIMIT 1);

-- Create missing email template if not exists
INSERT INTO enhanced_email_templates (
  template_key,
  template_name,
  subject_template,
  html_template,
  text_template,
  template_type,
  category,
  is_active,
  variables
) VALUES (
  'customer_welcome',
  'Customer Welcome Email',
  'Welcome to {{business_name}}!',
  '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
        <h1 style="color: #333; text-align: center;">Welcome to {{business_name}}!</h1>
        <p>Hello {{customerName}},</p>
        <p>Thank you for joining {{business_name}}. We''re excited to have you as part of our community.</p>
        <p>You can explore our delicious small chops and place your orders at: <a href="{{store_url}}" style="color: #007bff;">{{store_url}}</a></p>
        <p>If you have any questions, feel free to contact us at {{support_email}}.</p>
        <p style="margin-top: 30px;">Best regards,<br><strong>{{business_name}} Team</strong></p>
    </div>
</body>
</html>',
  'Welcome {{customerName}}!

Thank you for joining {{business_name}}. We''re excited to have you as part of our community.

Visit us at: {{store_url}}

Questions? Contact us at {{support_email}}

Best regards,
{{business_name}} Team',
  'transactional',
  'welcome',
  true,
  ARRAY['customerName', 'business_name', 'store_url', 'support_email']
) ON CONFLICT (template_key) DO UPDATE SET
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  is_active = true,
  updated_at = NOW();

-- Update all failed communication events to retry
UPDATE communication_events 
SET 
  status = 'queued',
  retry_count = COALESCE(retry_count, 0),
  error_message = NULL,
  updated_at = NOW()
WHERE status IN ('failed') 
  AND retry_count < 3 
  AND created_at > NOW() - INTERVAL '24 hours';

-- Clear stuck processing events
UPDATE communication_events 
SET 
  status = 'queued',
  updated_at = NOW()
WHERE status = 'processing' 
  AND updated_at < NOW() - INTERVAL '10 minutes';