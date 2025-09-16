-- CRITICAL PRODUCTION FIX: Add SMTP Test Template with correct column names
INSERT INTO email_templates (template_key, template_name, subject, html_content, text_content, is_active, template_type)
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
  'system'
) ON CONFLICT (template_key) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  updated_at = NOW();