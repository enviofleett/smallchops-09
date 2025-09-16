-- First, let's seed the missing email templates that are currently hardcoded in functions

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
-- Out for delivery template
(
  'out_for_delivery',
  'Order Out for Delivery Notification',
  'Your order #{{order_number}} is out for delivery!',
  '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Out for Delivery</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: #ffffff; padding: 32px 24px; text-align: center; }
        .content { padding: 32px 24px; }
        .info-box { background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0; }
        .driver-info { background: #e0f2fe; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #0284c7; }
        .order-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        .order-table th, .order-table td { padding: 12px 8px; border-bottom: 1px solid #e9ecef; }
        .order-table th { background: #f8f9fa; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 24px; text-align: center; color: #6b7280; }
        .emoji { font-size: 1.2em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Your Order is Out for Delivery! <span class="emoji">🚚</span></h1>
        </div>
        
        <div class="content">
            <p>Hi {{customer_name}},</p>
            <p>Great news! Your order <strong>#{{order_number}}</strong> is now out for delivery and should arrive soon.</p>
            
            {{#driver_name}}
            <div class="driver-info">
                <h3 style="margin: 0 0 8px 0; color: #0284c7;">Your Delivery Driver</h3>
                <p><strong>{{driver_name}}</strong></p>
                <p>Phone: {{driver_phone}}</p>
                <p>Vehicle: {{driver_vehicle_type}}</p>
            </div>
            {{/driver_name}}
            
            <div class="info-box">
                <h3 style="margin: 0 0 8px 0;">Delivery Details</h3>
                <p><strong>Address:</strong><br>{{delivery_address}}</p>
                {{#delivery_instructions}}
                <p><strong>Instructions:</strong> {{delivery_instructions}}</p>
                {{/delivery_instructions}}
                {{#estimated_delivery_time}}
                <p><strong>Estimated Time:</strong> {{estimated_delivery_time}}</p>
                {{/estimated_delivery_time}}
            </div>

            <h3>Order Summary</h3>
            <table class="order-table">
                <thead>
                    <tr>
                        <th style="text-align: left;">Item</th>
                        <th style="text-align: center;">Qty</th>
                        <th style="text-align: right;">Price</th>
                    </tr>
                </thead>
                <tbody>
                    {{order_items_html}}
                </tbody>
                <tfoot>
                    <tr style="font-weight: bold; background: #f8f9fa;">
                        <td colspan="2">Total</td>
                        <td style="text-align: right;">₦{{total_amount}}</td>
                    </tr>
                </tfoot>
            </table>

            <p style="margin-top: 24px;">Thank you for your order!</p>
            <p style="color: #666; font-size: 14px;">If you have any questions, please don''t hesitate to contact us.</p>
        </div>
        
        <div class="footer">
            <p>{{business_name}}</p>
        </div>
    </div>
</body>
</html>',
  'Your order #{{order_number}} is out for delivery!

Hi {{customer_name}},

Great news! Your order #{{order_number}} is now out for delivery and should arrive soon.

{{#driver_name}}
Your Driver: {{driver_name}}
Phone: {{driver_phone}}
Vehicle: {{driver_vehicle_type}}
{{/driver_name}}

Delivery Address: {{delivery_address}}
{{#delivery_instructions}}
Instructions: {{delivery_instructions}}
{{/delivery_instructions}}

Order Summary:
{{order_items_text}}
Total: ₦{{total_amount}}

Thank you for your order!

{{business_name}}',
  'full_html',
  true,
  ARRAY['customer_name', 'order_number', 'delivery_address', 'delivery_instructions', 'estimated_delivery_time', 'driver_name', 'driver_phone', 'driver_vehicle_type', 'order_items_html', 'order_items_text', 'total_amount', 'business_name']
),

-- Admin new order notification template  
(
  'admin_new_order',
  'Admin New Order Notification', 
  'New Order Received: {{order_number}}',
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
            
            {{#order_items_list}}
            <div class="items-list">
                <h3>Order Items</h3>
                {{order_items_list}}
            </div>
            {{/order_items_list}}
            
            <a href="{{admin_dashboard_link}}" class="btn">View Order Details</a>
        </div>
        
        <div class="footer">
            <p>{{business_name}} Admin Panel</p>
        </div>
    </div>
</body>
</html>',
  'New Order Alert - Order #{{order_number}}

Customer: {{customer_name}}
Email: {{customer_email}}
Phone: {{customer_phone}}
Total: ₦{{total_amount}}
Date: {{order_date}}

{{#order_items_list}}
Items:
{{order_items_list}}
{{/order_items_list}}

View order details: {{admin_dashboard_link}}

{{business_name}} Admin Panel',
  'full_html',
  true,
  ARRAY['order_number', 'customer_name', 'customer_email', 'customer_phone', 'total_amount', 'order_date', 'order_items_list', 'admin_dashboard_link', 'business_name']
)

ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  template_type = EXCLUDED.template_type,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- Ensure the email_templates view exists and works correctly
CREATE OR REPLACE VIEW email_templates AS
SELECT 
  template_key,
  template_name,
  subject_template as subject,
  html_template as html_content,
  text_template as text_content,
  template_type,
  is_active,
  variables,
  created_at,
  updated_at
FROM enhanced_email_templates
WHERE is_active = true;