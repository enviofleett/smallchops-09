-- Add email templates with correct column names
INSERT INTO public.enhanced_email_templates (template_key, template_name, subject_template, html_template, text_template, variables, template_type, is_active)
VALUES 
  ('welcome_customer', 'Customer Welcome Email', 'Welcome to {{businessName}}!', 
   '<h1>Welcome {{customerName}}!</h1><p>Thank you for joining {{businessName}}. We''re excited to have you on board.</p>', 
   'Welcome {{customerName}}! Thank you for joining {{businessName}}. We''re excited to have you on board.',
   ARRAY['customerName', 'businessName', 'email'], 'transactional', true),
  ('login_otp', 'Login OTP Code', 'Your Login Code', 
   '<h1>Your Login Code</h1><p>Use this code to log in: <strong>{{otpCode}}</strong></p><p>This code expires in 10 minutes.</p>', 
   'Your login code: {{otpCode}}. This code expires in 10 minutes.',
   ARRAY['otpCode', 'email'], 'transactional', true),
  ('password_reset_otp', 'Password Reset Code', 'Password Reset Code', 
   '<h1>Password Reset</h1><p>Use this code to reset your password: <strong>{{otpCode}}</strong></p><p>This code expires in 10 minutes.</p>', 
   'Your password reset code: {{otpCode}}. This code expires in 10 minutes.',
   ARRAY['otpCode', 'email'], 'transactional', true)
ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  variables = EXCLUDED.variables,
  template_type = EXCLUDED.template_type,
  is_active = EXCLUDED.is_active;