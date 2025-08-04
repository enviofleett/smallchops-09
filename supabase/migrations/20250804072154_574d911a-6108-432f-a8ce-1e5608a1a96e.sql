-- Create missing OTP email template for customer registration
INSERT INTO enhanced_email_templates (
  template_key,
  template_name,
  description,
  subject_template,
  html_template,
  text_template,
  category,
  is_active
) VALUES (
  'customer_registration_otp',
  'Customer Registration OTP',
  'Email template for sending OTP code during customer registration',
  'Verify Your Email - OTP Code: {{otpCode}}',
  '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background: #f9f9f9; padding: 30px; border-radius: 10px; }
        .header { text-align: center; margin-bottom: 30px; }
        .otp-code { background: {{primaryColor}}; color: white; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; letter-spacing: 3px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; }
        .cta-button { background: {{primaryColor}}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: {{primaryColor}};">Welcome to {{companyName}}!</h1>
            <p>Please verify your email address to complete your registration</p>
        </div>
        
        <p>Hi {{customerName}},</p>
        
        <p>Thank you for registering with {{companyName}}! To complete your account setup, please use the verification code below:</p>
        
        <div class="otp-code">{{otpCode}}</div>
        
        <p><strong>Important:</strong> This code will expire in {{expiryMinutes}} minutes for security reasons.</p>
        
        <p>If you did not request this registration, please ignore this email.</p>
        
        <div class="footer">
            <p>Best regards,<br>The {{companyName}} Team</p>
            <p><a href="{{websiteUrl}}" style="color: {{primaryColor}};">Visit our website</a></p>
            <p>If you need help, contact us at {{supportEmail}}</p>
        </div>
    </div>
</body>
</html>',
  'Welcome to {{companyName}}!

Hi {{customerName}},

Thank you for registering with {{companyName}}! To complete your account setup, please use the verification code below:

Your OTP Code: {{otpCode}}

Important: This code will expire in {{expiryMinutes}} minutes for security reasons.

If you did not request this registration, please ignore this email.

Best regards,
The {{companyName}} Team

Visit our website: {{websiteUrl}}
Need help? Contact us at {{supportEmail}}',
  'authentication',
  true
);