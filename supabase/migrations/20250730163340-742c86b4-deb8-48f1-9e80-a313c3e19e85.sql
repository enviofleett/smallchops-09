-- Insert default email templates for e-commerce flows
INSERT INTO enhanced_email_templates (template_key, template_name, subject_template, html_template, text_template, template_type, variables, is_active) VALUES

-- Order Confirmation Template
('order_confirmation', 'Order Confirmation', 'Order Confirmation - {{orderNumber}}', 
'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
        .order-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Order Confirmed!</h1>
        </div>
        <div class="content">
            <p>Hi {{customerName}},</p>
            <p>Thank you for your order! We''ve received your order and are preparing it for delivery.</p>
            
            <div class="order-details">
                <h3>Order Details</h3>
                <p><strong>Order Number:</strong> {{orderNumber}}</p>
                <p><strong>Order Date:</strong> {{orderDate}}</p>
                <p><strong>Total Amount:</strong> ${{orderTotal}}</p>
                <p><strong>Delivery Address:</strong> {{deliveryAddress}}</p>
            </div>
            
            <p>We''ll send you updates as your order progresses. If you have any questions, please don''t hesitate to contact us.</p>
            
            <a href="{{siteUrl}}/orders/{{orderNumber}}" class="button">Track Your Order</a>
        </div>
        <div class="footer">
            <p>{{companyName}}<br>{{companyAddress}}</p>
            <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> | <a href="{{privacyPolicyUrl}}">Privacy Policy</a></p>
        </div>
    </div>
</body>
</html>', 
'Hi {{customerName}},

Thank you for your order! We''ve received your order and are preparing it for delivery.

Order Details:
- Order Number: {{orderNumber}}
- Order Date: {{orderDate}}
- Total Amount: ${{orderTotal}}
- Delivery Address: {{deliveryAddress}}

We''ll send you updates as your order progresses. Track your order at: {{siteUrl}}/orders/{{orderNumber}}

Best regards,
{{companyName}}

Unsubscribe: {{unsubscribeUrl}}', 
'order', 
ARRAY['customerName', 'orderNumber', 'orderDate', 'orderTotal', 'deliveryAddress', 'siteUrl', 'companyName', 'companyAddress', 'unsubscribeUrl', 'privacyPolicyUrl'], 
true),

-- Welcome Email Template
('welcome_customer', 'Customer Welcome Email', 'Welcome to {{companyName}}!', 
'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
        .welcome-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to {{companyName}}!</h1>
        </div>
        <div class="content">
            <p>Hi {{customerName}},</p>
            <p>Welcome to {{companyName}}! We''re thrilled to have you as part of our community.</p>
            
            <div class="welcome-box">
                <h3>🎉 You''re all set!</h3>
                <p>Your account is ready and you can start shopping right away.</p>
                <a href="{{siteUrl}}" class="button">Start Shopping</a>
            </div>
            
            <p>Here''s what you can do with your account:</p>
            <ul>
                <li>Browse our complete product catalog</li>
                <li>Track your orders in real-time</li>
                <li>Save your favorite items</li>
                <li>Get exclusive member discounts</li>
            </ul>
            
            <p>If you have any questions, our support team is here to help!</p>
        </div>
        <div class="footer">
            <p>{{companyName}}<br>{{companyAddress}}</p>
            <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> | <a href="{{privacyPolicyUrl}}">Privacy Policy</a></p>
        </div>
    </div>
</body>
</html>', 
'Hi {{customerName}},

Welcome to {{companyName}}! We''re thrilled to have you as part of our community.

🎉 You''re all set!
Your account is ready and you can start shopping right away.

Here''s what you can do with your account:
- Browse our complete product catalog
- Track your orders in real-time
- Save your favorite items
- Get exclusive member discounts

Start shopping: {{siteUrl}}

If you have any questions, our support team is here to help!

Best regards,
{{companyName}}

Unsubscribe: {{unsubscribeUrl}}', 
'customer', 
ARRAY['customerName', 'companyName', 'companyAddress', 'siteUrl', 'unsubscribeUrl', 'privacyPolicyUrl'], 
true),

-- Order Status Update Template
('order_status_update', 'Order Status Update', 'Order {{orderNumber}} - Status Update', 
'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Status Update</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
        .status-update { background: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Order Update</h1>
        </div>
        <div class="content">
            <p>Hi {{customerName}},</p>
            <p>We have an update on your order:</p>
            
            <div class="status-update">
                <h3>📦 Order {{orderNumber}}</h3>
                <p><strong>Status:</strong> {{newStatus}}</p>
                {{#estimatedTime}}<p><strong>Estimated Time:</strong> {{estimatedTime}}</p>{{/estimatedTime}}
            </div>
            
            <p>{{#orderStatus}}
            {{#if (eq orderStatus "processing")}}Your order is being prepared and will be ready soon.{{/if}}
            {{#if (eq orderStatus "shipped")}}Your order has been shipped and is on its way to you.{{/if}}
            {{#if (eq orderStatus "delivered")}}Your order has been delivered! We hope you enjoy your purchase.{{/if}}
            {{#if (eq orderStatus "ready")}}Your order is ready for pickup at our store.{{/if}}
            {{/orderStatus}}</p>
            
            <a href="{{siteUrl}}/orders/{{orderNumber}}" class="button">Track Order</a>
        </div>
        <div class="footer">
            <p>{{companyName}}<br>{{companyAddress}}</p>
            <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> | <a href="{{privacyPolicyUrl}}">Privacy Policy</a></p>
        </div>
    </div>
</body>
</html>', 
'Hi {{customerName}},

We have an update on your order:

📦 Order {{orderNumber}}
Status: {{newStatus}}
{{#estimatedTime}}Estimated Time: {{estimatedTime}}{{/estimatedTime}}

Track your order: {{siteUrl}}/orders/{{orderNumber}}

Best regards,
{{companyName}}

Unsubscribe: {{unsubscribeUrl}}', 
'order', 
ARRAY['customerName', 'orderNumber', 'newStatus', 'oldStatus', 'estimatedTime', 'siteUrl', 'companyName', 'companyAddress', 'unsubscribeUrl', 'privacyPolicyUrl'], 
true),

-- Payment Confirmation Template
('payment_confirmation', 'Payment Confirmation', 'Payment Received - Order {{orderNumber}}', 
'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Confirmation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
        .payment-details { background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Payment Confirmed</h1>
        </div>
        <div class="content">
            <p>Hi {{customerName}},</p>
            <p>Great news! We''ve received your payment for order {{orderNumber}}.</p>
            
            <div class="payment-details">
                <h3>Payment Details</h3>
                <p><strong>Order Number:</strong> {{orderNumber}}</p>
                <p><strong>Amount Paid:</strong> ${{amount}}</p>
                <p><strong>Payment Method:</strong> {{paymentMethod}}</p>
                <p><strong>Transaction Date:</strong> {{transactionDate}}</p>
            </div>
            
            <p>Your order is now being processed and will be prepared for delivery/pickup shortly.</p>
            
            <a href="{{siteUrl}}/orders/{{orderNumber}}" class="button">View Order Details</a>
        </div>
        <div class="footer">
            <p>{{companyName}}<br>{{companyAddress}}</p>
            <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> | <a href="{{privacyPolicyUrl}}">Privacy Policy</a></p>
        </div>
    </div>
</body>
</html>', 
'Hi {{customerName}},

✅ Payment Confirmed

Great news! We''ve received your payment for order {{orderNumber}}.

Payment Details:
- Order Number: {{orderNumber}}
- Amount Paid: ${{amount}}
- Payment Method: {{paymentMethod}}
- Transaction Date: {{transactionDate}}

Your order is now being processed and will be prepared for delivery/pickup shortly.

View order details: {{siteUrl}}/orders/{{orderNumber}}

Best regards,
{{companyName}}

Unsubscribe: {{unsubscribeUrl}}', 
'order', 
ARRAY['customerName', 'orderNumber', 'amount', 'paymentMethod', 'transactionDate', 'siteUrl', 'companyName', 'companyAddress', 'unsubscribeUrl', 'privacyPolicyUrl'], 
true),

-- Admin New Order Notification
('admin_new_order', 'New Order Notification (Admin)', 'New Order Received - {{orderNumber}}', 
'<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Order Notification</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ffc107; color: #212529; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
        .order-summary { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔔 New Order Alert</h1>
        </div>
        <div class="content">
            <p>Hello Admin,</p>
            <p>A new order has been placed and requires your attention.</p>
            
            <div class="order-summary">
                <h3>Order Summary</h3>
                <p><strong>Order Number:</strong> {{orderNumber}}</p>
                <p><strong>Customer:</strong> {{customerName}}</p>
                <p><strong>Email:</strong> {{customerEmail}}</p>
                <p><strong>Phone:</strong> {{customerPhone}}</p>
                <p><strong>Total Amount:</strong> ${{orderTotal}}</p>
                <p><strong>Order Type:</strong> {{orderType}}</p>
                <p><strong>Order Time:</strong> {{orderDate}}</p>
            </div>
            
            <p>Please review and process this order promptly.</p>
            
            <a href="{{siteUrl}}/admin/orders/{{orderNumber}}" class="button">View Order in Admin</a>
        </div>
        <div class="footer">
            <p>{{companyName}} Admin System</p>
        </div>
    </div>
</body>
</html>', 
'🔔 New Order Alert

Hello Admin,

A new order has been placed and requires your attention.

Order Summary:
- Order Number: {{orderNumber}}
- Customer: {{customerName}}
- Email: {{customerEmail}}
- Phone: {{customerPhone}}
- Total Amount: ${{orderTotal}}
- Order Type: {{orderType}}
- Order Time: {{orderDate}}

Please review and process this order promptly.

View order: {{siteUrl}}/admin/orders/{{orderNumber}}

{{companyName}} Admin System', 
'admin', 
ARRAY['orderNumber', 'customerName', 'customerEmail', 'customerPhone', 'orderTotal', 'orderType', 'orderDate', 'siteUrl', 'companyName'], 
true);

-- Insert default SMTP settings if none exist
INSERT INTO communication_settings (
    smtp_host, 
    smtp_port, 
    smtp_user, 
    smtp_pass, 
    sender_email, 
    sender_name, 
    enable_email
) 
SELECT 
    'mail.enviofleet.com',
    587,
    'support@enviofleet.com',
    '',
    'support@enviofleet.com',
    'Starters',
    false
WHERE NOT EXISTS (SELECT 1 FROM communication_settings LIMIT 1);