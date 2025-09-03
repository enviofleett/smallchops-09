-- Create the missing order_canceled email template

INSERT INTO enhanced_email_templates (
  template_key,
  template_name,
  subject_template,
  html_template,
  text_template,
  variables,
  template_type,
  is_active,
  created_at,
  updated_at
) VALUES (
  'order_canceled',
  'Order Cancellation Notification',
  'Your Order #{order_number} Has Been Cancelled',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Cancelled</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #e74c3c; margin-bottom: 10px;">Order Cancelled</h1>
    <h2 style="color: #2c3e50; margin-top: 0;">We''ve Cancelled Your Order</h2>
  </div>
  
  <div style="background: #fdf2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #e74c3c;">
    <p><strong>Hi {{customer_name}},</strong></p>
    <p>We''re writing to let you know that your order has been cancelled as requested.</p>
    <p><strong>Order Number:</strong> {{order_number}}<br>
    <strong>Cancellation Date:</strong> {{cancellation_date}}<br>
    <strong>Reason:</strong> {{cancellation_reason}}</p>
  </div>
  
  <div style="margin: 20px 0;">
    <h3 style="color: #2c3e50;">What happens next?</h3>
    <ul style="padding-left: 20px;">
      <li>If you paid online, your refund will be processed within 3-5 business days</li>
      <li>You''ll receive a separate email confirmation once the refund is processed</li>
      <li>For cash orders, no payment was collected</li>
    </ul>
  </div>
  
  <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <p style="margin: 0; color: #6c757d; font-size: 14px;">
      <strong>Need help?</strong> We''re here to help! Contact us at {{support_email}} or place a new order anytime.
    </p>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <p style="color: #7f8c8d;">Questions? Contact us at {{support_email}}</p>
    <p style="color: #95a5a6; font-size: 14px;">© {{current_year}} {{business_name}}. All rights reserved.</p>
  </div>
</body>
</html>',
  'Order Cancelled - #{order_number}

Hi {{customer_name}},

We''re writing to let you know that your order has been cancelled as requested.

📋 Cancellation Details:
Order Number: {{order_number}}
Cancellation Date: {{cancellation_date}}
Reason: {{cancellation_reason}}

What happens next?
• If you paid online, your refund will be processed within 3-5 business days
• You''ll receive a separate email confirmation once the refund is processed  
• For cash orders, no payment was collected

Need help? We''re here to help! Contact us at {{support_email}} or place a new order anytime.

Questions? Contact us at {{support_email}}
© {{current_year}} {{business_name}}. All rights reserved.',
  ARRAY['customer_name', 'order_number', 'cancellation_date', 'cancellation_reason', 'support_email', 'business_name', 'current_year'],
  'transactional',
  true,
  NOW(),
  NOW()
) ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Log the template creation
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'email_template_seeded',
  'Email System',
  'Created missing order_canceled email template',
  jsonb_build_object(
    'template_key', 'order_canceled',
    'action', 'created',
    'timestamp', NOW()
  )
);