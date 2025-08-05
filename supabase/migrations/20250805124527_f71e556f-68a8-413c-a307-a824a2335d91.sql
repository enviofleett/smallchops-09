-- Insert missing email templates for order confirmation and admin notifications
INSERT INTO enhanced_email_templates (
  template_key,
  template_name,
  subject_template,
  html_template,
  text_template,
  template_type,
  is_active,
  variables
) VALUES 
(
  'admin_new_order',
  'Admin New Order Notification',
  'New Order Received: {{orderNumber}}',
  '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Order Notification</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: #2d3748; color: #ffffff; padding: 32px 24px; text-align: center; }
        .content { padding: 32px 24px; }
        .order-info { background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3182ce; }
        .btn { display: inline-block; background: #3182ce; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 24px; text-align: center; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Order Alert</h1>
        </div>
        
        <div class="content">
            <h2>Order #{{orderNumber}}</h2>
            
            <div class="order-info">
                <h3>Customer Information</h3>
                <p><strong>Name:</strong> {{customerName}}</p>
                <p><strong>Email:</strong> {{customerEmail}}</p>
                <p><strong>Order Total:</strong> {{orderTotal}}</p>
                <p><strong>Date:</strong> {{orderDate}}</p>
                <p><strong>Items Count:</strong> {{itemsCount}}</p>
            </div>
            
            <a href="{{adminDashboardLink}}" class="btn">View Order Details</a>
        </div>
        
        <div class="footer">
            <p>{{companyName}} Admin Panel</p>
        </div>
    </div>
</body>
</html>',
  'New Order Alert - Order #{{orderNumber}}

Customer: {{customerName}}
Email: {{customerEmail}}
Total: {{orderTotal}}
Date: {{orderDate}}
Items: {{itemsCount}}

View order details: {{adminDashboardLink}}

{{companyName}} Admin Panel',
  'transactional',
  true,
  ARRAY['orderNumber', 'customerName', 'customerEmail', 'orderTotal', 'orderDate', 'itemsCount', 'adminDashboardLink', 'companyName']
) ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  updated_at = NOW();

-- Insert customer welcome template
INSERT INTO enhanced_email_templates (
  template_key,
  template_name,
  subject_template,
  html_template,
  text_template,
  template_type,
  is_active,
  variables
) VALUES 
(
  'customer_welcome',
  'Customer Welcome Email',
  'Welcome to {{companyName}}!',
  '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #667eea, #764ba2); color: #ffffff; padding: 40px 24px; text-align: center; }
        .content { padding: 32px 24px; }
        .welcome-box { background: #f8fafc; padding: 24px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .btn { display: inline-block; background: #667eea; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0; }
        .footer { background: #f8f9fa; padding: 24px; text-align: center; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to {{companyName}}!</h1>
        </div>
        
        <div class="content">
            <div class="welcome-box">
                <h2>Hello {{customerName}}!</h2>
                <p>Thank you for joining {{companyName}}. We''re excited to have you as part of our community!</p>
                <a href="{{websiteUrl}}" class="btn">Start Shopping</a>
            </div>
            
            <p>If you have any questions, don''t hesitate to contact our support team at {{supportEmail}}.</p>
        </div>
        
        <div class="footer">
            <p>© {{companyName}}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>',
  'Welcome to {{companyName}}!

Hello {{customerName}}!

Thank you for joining {{companyName}}. We''re excited to have you as part of our community!

Visit us: {{websiteUrl}}

If you have any questions, contact us at {{supportEmail}}.

© {{companyName}}. All rights reserved.',
  'transactional',
  true,
  ARRAY['customerName', 'companyName', 'websiteUrl', 'supportEmail']
) ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  updated_at = NOW();