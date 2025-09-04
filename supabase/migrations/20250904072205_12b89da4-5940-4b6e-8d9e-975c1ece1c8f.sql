-- CRITICAL PRODUCTION FIX: Add SMTP Test Template and Update Health Check System

-- Add test template for production SMTP testing
INSERT INTO email_templates (template_key, template_name, subject_template, html_template, text_template, is_active, template_type, created_by)
VALUES (
  'smtp_connection_test',
  'SMTP Connection Test',
  'SMTP Connection Test - {{timestamp}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #10b981;">✅ SMTP Connection Test</h2>
    <p>Your SMTP configuration is working correctly.</p>
    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #bbf7d0;">
      <p><strong>Test Details:</strong></p>
      <ul>
        <li>Test Time: {{timestamp}}</li>
        <li>System: Production SMTP</li>
        <li>Status: Connection Successful ✅</li>
      </ul>
    </div>
    <p>This is an automated test to verify your email system is operational.</p>
  </div>',
  'SMTP Connection Test

Your SMTP configuration is working correctly.

Test Time: {{timestamp}}
System: Production SMTP  
Status: Connection Successful ✅

This is an automated test to verify your email system is operational.',
  true,
  'system',
  (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1)
) ON CONFLICT (template_key) DO UPDATE SET
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  updated_at = NOW();