
-- Fix all email templates for production: Remove unsupported syntax and ensure proper variable declarations

-- 1. Fix admin_new_order template - Remove Handlebars conditionals
UPDATE enhanced_email_templates
SET 
  html_template = '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Order Notification</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: #dc2626; color: #ffffff; padding: 32px 24px; text-align: center; }
        .content { padding: 32px 24px; }
        .order-info { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .btn { display: inline-block; background: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 24px; text-align: center; color: #6b7280; }
        .items-list { background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 New Order Alert</h1>
        </div>
        
        <div class="content">
            <h2>Order #{{order_number}}</h2>
            
            <div class="order-info">
                <h3>Customer Information</h3>
                <p><strong>Name:</strong> {{customer_name}}</p>
                <p><strong>Email:</strong> {{customer_email}}</p>
                <p><strong>Phone:</strong> {{customer_phone}}</p>
                <p><strong>Order Total:</strong> ₦{{total_amount}}</p>
                <p><strong>Date:</strong> {{order_date}}</p>
            </div>
            
            <div class="items-list">
                <h3>Order Items</h3>
                <p>{{order_items_list}}</p>
            </div>
            
            <a href="{{admin_dashboard_link}}" class="btn">View Order Details</a>
        </div>
        
        <div class="footer">
            <p>{{business_name}} Admin Panel</p>
        </div>
    </div>
</body>
</html>',
  text_template = 'New Order Alert - Order #{{order_number}}

Customer: {{customer_name}}
Email: {{customer_email}}
Phone: {{customer_phone}}
Total: ₦{{total_amount}}
Date: {{order_date}}

Items:
{{order_items_list}}

View order details: {{admin_dashboard_link}}

{{business_name}} Admin Panel',
  full_html = true
WHERE template_key = 'admin_new_order';

-- 2. Fix admin_order_status_changed template - Remove Handlebars conditionals
UPDATE enhanced_email_templates
SET 
  html_template = '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Status Update</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">Order Status Update</h1>
    </div>
    
    <div style="background: #fff; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
        <h2 style="color: #dc2626;">Order #{{orderNumber}} Status Changed</h2>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Customer:</strong> {{customerName}} ({{customerEmail}})</p>
            <p><strong>Previous Status:</strong> {{oldStatus}}</p>
            <p><strong>New Status:</strong> {{newStatus}}</p>
            <p><strong>Updated By:</strong> {{updatedBy}}</p>
            <p><strong>Update Time:</strong> {{updateTime}}</p>
            <p><strong>Notes:</strong> {{notes}}</p>
        </div>
        
        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #dc2626;">Order Summary</h3>
            <p><strong>Total Amount:</strong> ₦{{totalAmount}}</p>
            <p><strong>Order Type:</strong> {{orderType}}</p>
            <p><strong>Delivery Address:</strong> {{deliveryAddress}}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{adminDashboardLink}}" style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">View in Admin Dashboard</a>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 30px; font-size: 12px; color: #666;">
            <p><strong>Admin Alert:</strong> This is an internal notification for order status changes.</p>
        </div>
    </div>
    
    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>{{business_name}} Admin Notifications</p>
    </div>
</body>
</html>',
  variables = ARRAY['orderNumber', 'customerName', 'customerEmail', 'oldStatus', 'newStatus', 'updatedBy', 'updateTime', 'notes', 'totalAmount', 'orderType', 'deliveryAddress', 'adminDashboardLink', 'business_name'],
  full_html = true
WHERE template_key = 'admin_order_status_changed';

-- 3. Fix customer_welcome template
UPDATE enhanced_email_templates
SET 
  html_template = '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to {{business_name}}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
    <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 40px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 32px;">Welcome! 🎉</h1>
        </div>
        
        <div style="padding: 40px 30px;">
            <h2 style="color: #f59e0b; margin-top: 0;">Hi {{customerName}},</h2>
            
            <p style="font-size: 16px; margin: 20px 0;">Welcome to {{business_name}}! We''re thrilled to have you join our community.</p>
            
            <p style="font-size: 16px; margin: 20px 0;">Your account was created on {{signupDate}}.</p>
            
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 30px 0;">
                <h3 style="margin-top: 0; color: #92400e;">What''s Next?</h3>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li style="margin: 10px 0;">Browse our delicious menu</li>
                    <li style="margin: 10px 0;">Place your first order</li>
                    <li style="margin: 10px 0;">Enjoy fast delivery or pickup</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{{website_url}}" style="background: #f59e0b; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Start Ordering</a>
            </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
            <p style="margin: 0;">{{business_name}}</p>
            <p style="margin: 10px 0 0;">Need help? Contact us anytime!</p>
        </div>
    </div>
</body>
</html>',
  text_template = 'Welcome to {{business_name}}!

Hi {{customerName}},

Welcome! We''re thrilled to have you join our community.

Your account was created on {{signupDate}}.

What''s Next?
- Browse our delicious menu
- Place your first order
- Enjoy fast delivery or pickup

Start ordering: {{website_url}}

{{business_name}}
Need help? Contact us anytime!',
  variables = ARRAY['customerName', 'business_name', 'signupDate', 'website_url'],
  full_html = true
WHERE template_key = 'customer_welcome';

-- 4. Log the production fix
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'production_email_templates_fixed',
  'Email System',
  'Fixed all email templates for production - removed unsupported Handlebars syntax and ensured proper variable declarations',
  jsonb_build_object(
    'templates_fixed', ARRAY['admin_new_order', 'admin_order_status_changed', 'customer_welcome'],
    'changes', 'Removed {{#if}} and {{#each}} conditionals, declared all variables, set full_html=true',
    'timestamp', NOW()
  )
);
