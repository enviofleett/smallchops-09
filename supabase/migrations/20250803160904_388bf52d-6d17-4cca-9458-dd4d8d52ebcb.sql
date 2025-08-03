-- Create missing SMTP test template
INSERT INTO public.enhanced_email_templates (
  template_key,
  template_name,
  subject,
  html_content,
  text_content,
  variables,
  category,
  is_active,
  created_at,
  updated_at
) VALUES (
  'smtp_test',
  'SMTP Connection Test',
  'SMTP Test - Connection Successful',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #22c55e;">✅ SMTP Connection Test Successful!</h2>
    <p>Your SMTP configuration is working correctly.</p>
    <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0;">Connection Details:</h3>
      <p><strong>Test Time:</strong> {{test_time}}</p>
      <p><strong>SMTP Host:</strong> {{smtp_host}}</p>
      <p><strong>Status:</strong> <span style="color: #22c55e;">Connected Successfully</span></p>
    </div>
    <p style="color: #64748b;">You can now send emails reliably to your customers.</p>
  </div>',
  'SMTP Connection Test Successful! Your email configuration is working correctly. Test completed at {{test_time}} using {{smtp_host}}.',
  '["test_time", "smtp_host", "business_name"]',
  'system',
  true,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  variables = EXCLUDED.variables,
  is_active = true,
  updated_at = NOW();

-- Add missing welcome email template if not exists
INSERT INTO public.enhanced_email_templates (
  template_key,
  template_name,
  subject,
  html_content,
  text_content,
  variables,
  category,
  is_active,
  created_at,
  updated_at
) VALUES (
  'welcome_customer',
  'Customer Welcome Email',
  'Welcome to {{business_name}}!',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #3b82f6;">Welcome to {{business_name}}!</h1>
    <p>Hi {{customer_name}},</p>
    <p>Thank you for joining us! We''re excited to have you as part of our community.</p>
    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3>What''s Next?</h3>
      <ul>
        <li>Browse our delicious menu</li>
        <li>Place your first order</li>
        <li>Enjoy fast delivery to your location</li>
      </ul>
    </div>
    <p>If you have any questions, don''t hesitate to reach out!</p>
    <p>Best regards,<br>The {{business_name}} Team</p>
  </div>',
  'Welcome to {{business_name}}! Hi {{customer_name}}, thank you for joining us! We''re excited to have you as part of our community.',
  '["customer_name", "business_name", "customer_email"]',
  'customer',
  true,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  variables = EXCLUDED.variables,
  is_active = true,
  updated_at = NOW();

-- Create SMTP health monitoring table
CREATE TABLE IF NOT EXISTS public.smtp_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  connection_status TEXT NOT NULL, -- 'success', 'failed', 'timeout'
  response_time_ms INTEGER,
  error_message TEXT,
  test_type TEXT DEFAULT 'connection', -- 'connection', 'send_test', 'authentication'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on SMTP health logs
ALTER TABLE public.smtp_health_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view SMTP health logs
CREATE POLICY "Admins can view SMTP health logs" 
ON public.smtp_health_logs 
FOR SELECT 
USING (is_admin());

-- Create policy for service roles to insert SMTP health logs
CREATE POLICY "Service roles can insert SMTP health logs" 
ON public.smtp_health_logs 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_smtp_health_logs_created_at ON public.smtp_health_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smtp_health_logs_provider ON public.smtp_health_logs(provider_name, created_at DESC);