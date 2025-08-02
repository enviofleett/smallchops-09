-- Phase 1: Critical Infrastructure Fixes

-- 1. Fix failed emails by resetting them to queued status
UPDATE communication_events 
SET status = 'queued', 
    retry_count = 0, 
    error_message = NULL, 
    last_error = NULL
WHERE status = 'failed' AND retry_count >= 3;

-- 2. Create database trigger for real-time email processing
CREATE OR REPLACE FUNCTION trigger_email_processing()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for customer_welcome emails to avoid loops
  IF NEW.event_type = 'customer_welcome' AND NEW.status = 'queued' THEN
    -- Invoke the edge function asynchronously using pg_net
    PERFORM
      net.http_post(
        url := 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/process-communication-events-enhanced',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := jsonb_build_object(
          'immediate_processing', true,
          'event_id', NEW.id::text
        )
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS email_processing_trigger ON communication_events;
CREATE TRIGGER email_processing_trigger
  AFTER INSERT ON communication_events
  FOR EACH ROW
  EXECUTE FUNCTION trigger_email_processing();

-- 3. Ensure welcome_customer template exists
INSERT INTO enhanced_email_templates (
  template_key,
  template_name,
  subject_template,
  html_template,
  text_template,
  is_active,
  created_by
) VALUES (
  'welcome_customer',
  'Customer Welcome Email',
  'Welcome to {{companyName}}, {{customerName}}!',
  '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to {{companyName}}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="color: {{primaryColor}}; font-size: 28px; margin: 0;">Welcome to {{companyName}}!</h1>
        </div>
        
        <div style="margin-bottom: 30px;">
            <p style="font-size: 18px; color: #333; margin: 0 0 15px 0;">Hello {{customerName}},</p>
            <p style="font-size: 16px; color: #666; line-height: 1.6; margin: 0 0 20px 0;">
                Thank you for joining {{companyName}}! We''re excited to have you as part of our community.
            </p>
            <p style="font-size: 16px; color: #666; line-height: 1.6; margin: 0 0 20px 0;">
                You can now browse our products, place orders, and enjoy our services.
            </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{websiteUrl}}" style="display: inline-block; background-color: {{primaryColor}}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-size: 16px;">
                Start Shopping
            </a>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="font-size: 14px; color: #999; margin: 0;">
                Need help? Contact us at <a href="mailto:{{supportEmail}}" style="color: {{primaryColor}};">{{supportEmail}}</a>
            </p>
            <p style="font-size: 12px; color: #ccc; margin: 10px 0 0 0;">
                © 2025 {{companyName}}. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>',
  'Welcome to {{companyName}}, {{customerName}}!

Thank you for joining us! We''re excited to have you as part of our community.

You can now browse our products, place orders, and enjoy our services.

Visit us at: {{websiteUrl}}

Need help? Contact us at {{supportEmail}}

© 2025 {{companyName}}. All rights reserved.',
  true,
  (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)
) ON CONFLICT (template_key) DO UPDATE SET
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  is_active = true,
  updated_at = NOW();

-- 4. Create instant email processing endpoint function (will be created as edge function)
-- This will be handled in the edge function update