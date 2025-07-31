-- Add category and style columns to enhanced_email_templates
ALTER TABLE public.enhanced_email_templates 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'transactional',
ADD COLUMN IF NOT EXISTS style text DEFAULT 'clean';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_enhanced_email_templates_category ON public.enhanced_email_templates(category);
CREATE INDEX IF NOT EXISTS idx_enhanced_email_templates_style ON public.enhanced_email_templates(style);
CREATE INDEX IF NOT EXISTS idx_enhanced_email_templates_category_style ON public.enhanced_email_templates(category, style);

-- Insert all 15 professional email templates
INSERT INTO public.enhanced_email_templates (
  template_key, template_name, subject_template, html_template, text_template, 
  template_type, category, style, variables, is_active
) VALUES 
-- Order Confirmation Templates
('order_confirmation_clean', 'Order Confirmation - Clean', 'Order Confirmation #{orderNumber}', 
'<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9f9f9; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #2563eb; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .order-details { background: #f8fafc; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .footer { background: #f1f5f9; padding: 20px; text-align: center; color: #64748b; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
        @media only screen and (max-width: 600px) { .container { margin: 0; border-radius: 0; } .content, .header { padding: 20px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Thank You for Your Order!</h1>
            <p>Order #{orderNumber}</p>
        </div>
        <div class="content">
            <p>Hi {{customerName}},</p>
            <p>We''re excited to confirm that we''ve received your order and it''s being processed.</p>
            <div class="order-details">
                <h3>Order Summary</h3>
                <p><strong>Order Number:</strong> {{orderNumber}}</p>
                <p><strong>Order Total:</strong> {{orderTotal}}</p>
                <p><strong>Order Date:</strong> {{orderDate}}</p>
                <p><strong>Delivery Type:</strong> {{orderType}}</p>
            </div>
            <p>We''ll send you another email when your order ships. If you have any questions, please don''t hesitate to contact us.</p>
            <a href="{{trackingUrl}}" class="button">Track Your Order</a>
        </div>
        <div class="footer">
            <p>© {{businessName}} | {{businessAddress}}</p>
        </div>
    </div>
</body>
</html>',
'Thank you for your order!

Hi {{customerName}},

We''re excited to confirm that we''ve received your order #{{orderNumber}} and it''s being processed.

Order Summary:
- Order Number: {{orderNumber}}
- Order Total: {{orderTotal}}
- Order Date: {{orderDate}}
- Delivery Type: {{orderType}}

We''ll send you another email when your order ships.

Track your order: {{trackingUrl}}

Best regards,
{{businessName}}', 
'transactional', 'order', 'clean', 
'{customerName,orderNumber,orderTotal,orderDate,orderType,trackingUrl,businessName,businessAddress}', true),

('order_confirmation_modern', 'Order Confirmation - Modern', 'Your order is confirmed! #{orderNumber}', 
'<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
    <style>
        body { font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; position: relative; }
        .header::after { content: ""; position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 15px solid transparent; border-right: 15px solid transparent; border-top: 10px solid #764ba2; }
        .content { padding: 40px; }
        .order-card { background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #667eea; }
        .footer { background: #f9fafb; padding: 25px; text-align: center; color: #6b7280; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
        .status-badge { background: #10b981; color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        @media only screen and (max-width: 600px) { .container { margin: 10px; border-radius: 12px; } .content, .header { padding: 25px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 28px;">Order Confirmed! 🎉</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">#{orderNumber}</p>
        </div>
        <div class="content">
            <p>Hello {{customerName}}! 👋</p>
            <p>Fantastic news! Your order has been confirmed and we''re already working on it.</p>
            <div class="order-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0;">Order Details</h3>
                    <span class="status-badge">CONFIRMED</span>
                </div>
                <p><strong>Order:</strong> {{orderNumber}}</p>
                <p><strong>Total:</strong> {{orderTotal}}</p>
                <p><strong>Date:</strong> {{orderDate}}</p>
                <p><strong>Type:</strong> {{orderType}}</p>
            </div>
            <p>🚀 Next up: We''ll prepare your order and send you tracking details soon!</p>
            <a href="{{trackingUrl}}" class="button">Track Order Progress</a>
        </div>
        <div class="footer">
            <p>{{businessName}} | {{businessAddress}}</p>
        </div>
    </div>
</body>
</html>',
'Order Confirmed! 🎉

Hello {{customerName}}! 👋

Fantastic news! Your order #{{orderNumber}} has been confirmed and we''re already working on it.

Order Details:
✓ Order: {{orderNumber}}
✓ Total: {{orderTotal}}
✓ Date: {{orderDate}}
✓ Type: {{orderType}}

🚀 Next up: We''ll prepare your order and send you tracking details soon!

Track your order: {{trackingUrl}}

Best regards,
{{businessName}}', 
'transactional', 'order', 'modern', 
'{customerName,orderNumber,orderTotal,orderDate,orderType,trackingUrl,businessName,businessAddress}', true),

('order_confirmation_bold', 'Order Confirmation - Bold', '🔥 ORDER CONFIRMED: #{orderNumber}', 
'<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
    <style>
        body { font-family: "Arial Black", Arial, sans-serif; line-height: 1.5; color: #000; margin: 0; padding: 0; background: #ff4444; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 0; overflow: hidden; border: 5px solid #000; }
        .header { background: #000; color: #ff4444; padding: 30px; text-align: center; }
        .content { padding: 30px; background: white; }
        .alert-box { background: #ff4444; color: white; padding: 20px; margin: 20px 0; border: 3px solid #000; font-weight: bold; text-align: center; }
        .order-summary { background: #ffff00; color: #000; padding: 20px; border: 3px solid #000; margin: 20px 0; }
        .footer { background: #000; color: white; padding: 20px; text-align: center; font-weight: bold; }
        .mega-button { display: inline-block; background: #ff4444; color: white; padding: 20px 40px; text-decoration: none; border: 3px solid #000; margin: 20px 0; font-weight: bold; font-size: 18px; text-transform: uppercase; }
        .mega-button:hover { background: #000; color: #ff4444; }
        @media only screen and (max-width: 600px) { .container { margin: 10px; } .content, .header { padding: 20px; } .mega-button { padding: 15px 30px; font-size: 16px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 32px; text-transform: uppercase;">🔥 BOOM! 🔥</h1>
            <p style="margin: 10px 0 0 0; font-size: 20px;">ORDER LOCKED IN!</p>
        </div>
        <div class="content">
            <div class="alert-box">
                <h2 style="margin: 0;">{{customerName}}, YOUR ORDER IS SECURED!</h2>
            </div>
            <p style="font-size: 18px; font-weight: bold;">This is it! Your order is officially in our system and we''re moving FAST!</p>
            <div class="order-summary">
                <h3 style="margin: 0 0 15px 0; font-size: 24px;">⚡ ORDER BREAKDOWN ⚡</h3>
                <p style="font-size: 16px; margin: 5px 0;"><strong>ORDER ID:</strong> {{orderNumber}}</p>
                <p style="font-size: 16px; margin: 5px 0;"><strong>TOTAL DAMAGE:</strong> {{orderTotal}}</p>
                <p style="font-size: 16px; margin: 5px 0;"><strong>LOCKED IN:</strong> {{orderDate}}</p>
                <p style="font-size: 16px; margin: 5px 0;"><strong>DELIVERY MODE:</strong> {{orderType}}</p>
            </div>
            <p style="font-size: 16px; font-weight: bold;">NO BACKING DOWN NOW! We''re preparing your order with lightning speed!</p>
            <a href="{{trackingUrl}}" class="mega-button">🔍 TRACK THIS BEAST</a>
        </div>
        <div class="footer">
            <p>{{businessName}} | WE DELIVER THE GOODS!</p>
        </div>
    </div>
</body>
</html>',
'🔥 BOOM! ORDER CONFIRMED! 🔥

{{customerName}}, YOUR ORDER IS SECURED!

This is it! Order #{{orderNumber}} is officially in our system and we''re moving FAST!

⚡ ORDER BREAKDOWN ⚡
- ORDER ID: {{orderNumber}}
- TOTAL: {{orderTotal}}
- DATE: {{orderDate}}
- TYPE: {{orderType}}

NO BACKING DOWN NOW! We''re preparing your order with lightning speed!

Track this beast: {{trackingUrl}}

{{businessName}} | WE DELIVER THE GOODS!', 
'transactional', 'order', 'bold', 
'{customerName,orderNumber,orderTotal,orderDate,orderType,trackingUrl,businessName,businessAddress}', true),

('order_confirmation_elegant', 'Order Confirmation - Elegant', 'Your Exquisite Order Confirmation #{orderNumber}', 
'<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
    <style>
        body { font-family: "Georgia", "Times New Roman", serif; line-height: 1.8; color: #2c2c2c; margin: 0; padding: 0; background: #f7f5f3; }
        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 0; overflow: hidden; box-shadow: 0 0 30px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(45deg, #8b7355 0%, #a0956b 100%); color: white; padding: 40px; text-align: center; position: relative; }
        .ornament { font-size: 24px; margin: 10px 0; }
        .content { padding: 40px; }
        .elegant-card { background: #faf9f7; padding: 30px; border-left: 3px solid #8b7355; margin: 30px 0; position: relative; }
        .elegant-card::before { content: "❦"; position: absolute; top: 15px; right: 20px; color: #8b7355; font-size: 24px; }
        .footer { background: #2c2c2c; color: #d4c5a0; padding: 30px; text-align: center; }
        .refined-button { display: inline-block; background: transparent; color: #8b7355; padding: 16px 32px; text-decoration: none; border: 2px solid #8b7355; margin: 25px 0; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; font-size: 14px; }
        .refined-button:hover { background: #8b7355; color: white; }
        h1 { font-size: 28px; margin: 0; letter-spacing: 2px; }
        h3 { color: #8b7355; margin-bottom: 20px; }
        @media only screen and (max-width: 600px) { .container { margin: 10px; } .content, .header { padding: 25px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="ornament">❦ ❦ ❦</div>
            <h1>Order Confirmed</h1>
            <p style="margin: 15px 0 0 0; font-size: 18px; letter-spacing: 1px;">with Gratitude</p>
            <div class="ornament">❦ ❦ ❦</div>
        </div>
        <div class="content">
            <p>Dear {{customerName}},</p>
            <p>It is with great pleasure that we confirm the receipt of your distinguished order. Every detail has been carefully noted and will be handled with the utmost care.</p>
            <div class="elegant-card">
                <h3>Order Particulars</h3>
                <p><em>Order Reference:</em> {{orderNumber}}</p>
                <p><em>Total Investment:</em> {{orderTotal}}</p>
                <p><em>Date of Order:</em> {{orderDate}}</p>
                <p><em>Service Type:</em> {{orderType}}</p>
            </div>
            <p>Rest assured, your order will receive our finest attention. We shall inform you promptly of any developments regarding your purchase.</p>
            <a href="{{trackingUrl}}" class="refined-button">Monitor Progress</a>
        </div>
        <div class="footer">
            <p>With Distinguished Regards<br>{{businessName}}</p>
            <p style="font-size: 14px; margin-top: 15px;">{{businessAddress}}</p>
        </div>
    </div>
</body>
</html>',
'Order Confirmed with Gratitude

Dear {{customerName}},

It is with great pleasure that we confirm the receipt of your distinguished order #{{orderNumber}}. Every detail has been carefully noted and will be handled with the utmost care.

Order Particulars:
- Order Reference: {{orderNumber}}
- Total Investment: {{orderTotal}}
- Date of Order: {{orderDate}}
- Service Type: {{orderType}}

Rest assured, your order will receive our finest attention. We shall inform you promptly of any developments.

Monitor your order: {{trackingUrl}}

With Distinguished Regards,
{{businessName}}', 
'transactional', 'order', 'elegant', 
'{customerName,orderNumber,orderTotal,orderDate,orderType,trackingUrl,businessName,businessAddress}', true),

-- Shipping Update Templates
('shipping_update_clean', 'Shipping Update - Clean', 'Your order #{orderNumber} is on the way!', 
'<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shipping Update</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9f9f9; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #059669; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .tracking-info { background: #f0fdf4; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #059669; }
        .footer { background: #f1f5f9; padding: 20px; text-align: center; color: #64748b; }
        .button { display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
        @media only screen and (max-width: 600px) { .container { margin: 0; border-radius: 0; } .content, .header { padding: 20px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 Your Order is Shipped!</h1>
            <p>Order #{orderNumber}</p>
        </div>
        <div class="content">
            <p>Hi {{customerName}},</p>
            <p>Great news! Your order has been shipped and is on its way to you.</p>
            <div class="tracking-info">
                <h3>Shipping Details</h3>
                <p><strong>Tracking Number:</strong> {{trackingNumber}}</p>
                <p><strong>Carrier:</strong> {{shippingCarrier}}</p>
                <p><strong>Estimated Delivery:</strong> {{estimatedDelivery}}</p>
                <p><strong>Shipping Address:</strong> {{shippingAddress}}</p>
            </div>
            <p>You can track your package using the tracking number above or click the button below.</p>
            <a href="{{trackingUrl}}" class="button">Track Your Package</a>
        </div>
        <div class="footer">
            <p>© {{businessName}} | {{businessAddress}}</p>
        </div>
    </div>
</body>
</html>',
'Your order is shipped! 📦

Hi {{customerName}},

Great news! Your order #{{orderNumber}} has been shipped and is on its way to you.

Shipping Details:
- Tracking Number: {{trackingNumber}}
- Carrier: {{shippingCarrier}}
- Estimated Delivery: {{estimatedDelivery}}
- Shipping Address: {{shippingAddress}}

Track your package: {{trackingUrl}}

Best regards,
{{businessName}}', 
'transactional', 'shipping', 'clean', 
'{customerName,orderNumber,trackingNumber,shippingCarrier,estimatedDelivery,shippingAddress,trackingUrl,businessName,businessAddress}', true),

('shipping_update_modern', 'Shipping Update - Modern', '🚚 On the move! Order #{orderNumber}', 
'<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shipping Update</title>
    <style>
        body { font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px; text-align: center; }
        .content { padding: 40px; }
        .shipping-card { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 25px; border-radius: 12px; margin: 25px 0; }
        .timeline { display: flex; justify-content: space-between; margin: 20px 0; }
        .timeline-step { text-align: center; flex: 1; }
        .timeline-icon { width: 40px; height: 40px; border-radius: 50%; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; font-weight: bold; }
        .footer { background: #f9fafb; padding: 25px; text-align: center; color: #6b7280; }
        .button { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
        @media only screen and (max-width: 600px) { .container { margin: 10px; border-radius: 12px; } .content, .header { padding: 25px; } .timeline { flex-direction: column; } .timeline-step { margin-bottom: 15px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 28px;">🚚 En Route!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Your package is traveling to you</p>
        </div>
        <div class="content">
            <p>Hello {{customerName}}! 👋</p>
            <p>Exciting update! Your order is now in transit and making its way to your doorstep.</p>
            <div class="timeline">
                <div class="timeline-step">
                    <div class="timeline-icon">✓</div>
                    <small>Ordered</small>
                </div>
                <div class="timeline-step">
                    <div class="timeline-icon">✓</div>
                    <small>Packed</small>
                </div>
                <div class="timeline-step">
                    <div class="timeline-icon">🚚</div>
                    <small>Shipped</small>
                </div>
                <div class="timeline-step">
                    <div class="timeline-icon" style="background: #e5e7eb; color: #6b7280;">📍</div>
                    <small>Delivered</small>
                </div>
            </div>
            <div class="shipping-card">
                <h3 style="margin: 0 0 15px 0;">📋 Shipping Information</h3>
                <p><strong>📦 Tracking:</strong> {{trackingNumber}}</p>
                <p><strong>🚛 Carrier:</strong> {{shippingCarrier}}</p>
                <p><strong>📅 ETA:</strong> {{estimatedDelivery}}</p>
                <p><strong>📍 Destination:</strong> {{shippingAddress}}</p>
            </div>
            <p>🔔 We''ll notify you as soon as your package arrives!</p>
            <a href="{{trackingUrl}}" class="button">🔍 Live Tracking</a>
        </div>
        <div class="footer">
            <p>{{businessName}} | {{businessAddress}}</p>
        </div>
    </div>
</body>
</html>',
'🚚 En Route! Your package is traveling to you

Hello {{customerName}}! 👋

Exciting update! Your order #{{orderNumber}} is now in transit and making its way to your doorstep.

📋 Shipping Information:
📦 Tracking: {{trackingNumber}}
🚛 Carrier: {{shippingCarrier}}
📅 ETA: {{estimatedDelivery}}
📍 Destination: {{shippingAddress}}

🔔 We''ll notify you as soon as your package arrives!

Live Tracking: {{trackingUrl}}

{{businessName}}', 
'transactional', 'shipping', 'modern', 
'{customerName,orderNumber,trackingNumber,shippingCarrier,estimatedDelivery,shippingAddress,trackingUrl,businessName,businessAddress}', true),

('shipping_update_bold', 'Shipping Update - Bold', '🚨 PACKAGE INCOMING! #{orderNumber}', 
'<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shipping Update</title>
    <style>
        body { font-family: "Arial Black", Arial, sans-serif; line-height: 1.5; color: #000; margin: 0; padding: 0; background: #00ff00; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 0; overflow: hidden; border: 5px solid #000; }
        .header { background: #000; color: #00ff00; padding: 30px; text-align: center; }
        .content { padding: 30px; background: white; }
        .alert-box { background: #00ff00; color: #000; padding: 20px; margin: 20px 0; border: 3px solid #000; font-weight: bold; text-align: center; }
        .tracking-box { background: #ffff00; color: #000; padding: 20px; border: 3px solid #000; margin: 20px 0; }
        .footer { background: #000; color: white; padding: 20px; text-align: center; font-weight: bold; }
        .mega-button { display: inline-block; background: #00ff00; color: #000; padding: 20px 40px; text-decoration: none; border: 3px solid #000; margin: 20px 0; font-weight: bold; font-size: 18px; text-transform: uppercase; }
        .mega-button:hover { background: #000; color: #00ff00; }
        @media only screen and (max-width: 600px) { .container { margin: 10px; } .content, .header { padding: 20px; } .mega-button { padding: 15px 30px; font-size: 16px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 32px; text-transform: uppercase;">🚨 INCOMING! 🚨</h1>
            <p style="margin: 10px 0 0 0; font-size: 20px;">PACKAGE DEPLOYED!</p>
        </div>
        <div class="content">
            <div class="alert-box">
                <h2 style="margin: 0;">{{customerName}}, YOUR PACKAGE IS MOVING!</h2>
            </div>
            <p style="font-size: 18px; font-weight: bold;">MISSION STATUS: Your order has LEFT THE BUILDING and is speeding toward your location!</p>
            <div class="tracking-box">
                <h3 style="margin: 0 0 15px 0; font-size: 24px;">🎯 PACKAGE INTEL 🎯</h3>
                <p style="font-size: 16px; margin: 5px 0;"><strong>TRACKING CODE:</strong> {{trackingNumber}}</p>
                <p style="font-size: 16px; margin: 5px 0;"><strong>TRANSPORT UNIT:</strong> {{shippingCarrier}}</p>
                <p style="font-size: 16px; margin: 5px 0;"><strong>ETA:</strong> {{estimatedDelivery}}</p>
                <p style="font-size: 16px; margin: 5px 0;"><strong>TARGET LOCATION:</strong> {{shippingAddress}}</p>
            </div>
            <p style="font-size: 16px; font-weight: bold;">GET READY! This package is coming in HOT!</p>
            <a href="{{trackingUrl}}" class="mega-button">🔍 TRACK THE BEAST</a>
        </div>
        <div class="footer">
            <p>{{businessName}} | PACKAGE DELIVERY SPECIALISTS!</p>
        </div>
    </div>
</body>
</html>',
'🚨 INCOMING! PACKAGE DEPLOYED! 🚨

{{customerName}}, YOUR PACKAGE IS MOVING!

MISSION STATUS: Order #{{orderNumber}} has LEFT THE BUILDING and is speeding toward your location!

🎯 PACKAGE INTEL 🎯
- TRACKING CODE: {{trackingNumber}}
- TRANSPORT UNIT: {{shippingCarrier}}
- ETA: {{estimatedDelivery}}
- TARGET LOCATION: {{shippingAddress}}

GET READY! This package is coming in HOT!

Track the beast: {{trackingUrl}}

{{businessName}} | PACKAGE DELIVERY SPECIALISTS!', 
'transactional', 'shipping', 'bold', 
'{customerName,orderNumber,trackingNumber,shippingCarrier,estimatedDelivery,shippingAddress,trackingUrl,businessName,businessAddress}', true),

-- Abandoned Cart Templates
('abandoned_cart_clean', 'Abandoned Cart Recovery - Clean', 'You left something behind!', 
'<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Abandoned Cart</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9f9f9; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #f59e0b; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .cart-items { background: #fffbeb; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .footer { background: #f1f5f9; padding: 20px; text-align: center; color: #64748b; }
        .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
        .urgency { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 15px; border-radius: 6px; margin: 15px 0; text-align: center; }
        @media only screen and (max-width: 600px) { .container { margin: 0; border-radius: 0; } .content, .header { padding: 20px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛒 Don''t Leave Empty-Handed!</h1>
            <p>Your cart is waiting for you</p>
        </div>
        <div class="content">
            <p>Hi {{customerName}},</p>
            <p>We noticed you left some great items in your cart. Don''t worry, we''ve saved them for you!</p>
            <div class="cart-items">
                <h3>Your Saved Items</h3>
                <p>{{cartItems}}</p>
                <p><strong>Total Value:</strong> {{cartTotal}}</p>
            </div>
            <div class="urgency">
                ⏰ Hurry! These items are in high demand and may sell out soon.
            </div>
            <p>Complete your purchase now and get these items delivered to your door.</p>
            <a href="{{checkoutUrl}}" class="button">Complete Your Purchase</a>
            <p><small>This cart will be saved for {{expiryDays}} more days.</small></p>
        </div>
        <div class="footer">
            <p>© {{businessName}} | {{businessAddress}}</p>
        </div>
    </div>
</body>
</html>',
'Don''t leave empty-handed! 🛒

Hi {{customerName}},

We noticed you left some great items in your cart. Don''t worry, we''ve saved them for you!

Your Saved Items:
{{cartItems}}
Total Value: {{cartTotal}}

⏰ Hurry! These items are in high demand and may sell out soon.

Complete your purchase: {{checkoutUrl}}

This cart will be saved for {{expiryDays}} more days.

{{businessName}}', 
'marketing', 'cart', 'clean', 
'{customerName,cartItems,cartTotal,checkoutUrl,expiryDays,businessName,businessAddress}', true),

('abandoned_cart_modern', 'Abandoned Cart Recovery - Modern', '🔔 Your cart misses you!', 
'<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Abandoned Cart</title>
    <style>
        body { font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 40px; text-align: center; }
        .content { padding: 40px; }
        .cart-card { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); padding: 25px; border-radius: 12px; margin: 25px 0; }
        .countdown { background: #fee2e2; color: #dc2626; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; font-weight: 600; }
        .footer { background: #f9fafb; padding: 25px; text-align: center; color: #6b7280; }
        .button { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
        .discount-badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; display: inline-block; margin: 10px 0; }
        @media only screen and (max-width: 600px) { .container { margin: 10px; border-radius: 12px; } .content, .header { padding: 25px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 28px;">🔔 Cart Alert!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Your items are waiting</p>
        </div>
        <div class="content">
            <p>Hey {{customerName}}! 👋</p>
            <p>Looks like you got distracted! No worries, we''ve kept your awesome picks safe and sound.</p>
            <div class="cart-card">
                <h3 style="margin: 0 0 15px 0;">🛒 Your Curated Selection</h3>
                <p>{{cartItems}}</p>
                <p><strong>🏷️ Total Investment:</strong> {{cartTotal}}</p>
            </div>
            <div class="countdown">
                ⏰ Limited Time: {{expiryDays}} days remaining to secure these items!
            </div>
            <div class="discount-badge">💸 SPECIAL: 10% OFF if you complete now!</div>
            <p>💡 Pro tip: These items are flying off our shelves. Don''t miss out!</p>
            <a href="{{checkoutUrl}}" class="button">🚀 Secure My Items</a>
        </div>
        <div class="footer">
            <p>{{businessName}} | {{businessAddress}}</p>
        </div>
    </div>
</body>
</html>',
'🔔 Cart Alert! Your items are waiting

Hey {{customerName}}! 👋

Looks like you got distracted! No worries, we''ve kept your awesome picks safe and sound.

🛒 Your Curated Selection:
{{cartItems}}
🏷️ Total: {{cartTotal}}

⏰ Limited Time: {{expiryDays}} days remaining!
💸 SPECIAL: 10% OFF if you complete now!

💡 Pro tip: These items are flying off our shelves. Don''t miss out!

Secure your items: {{checkoutUrl}}

{{businessName}}', 
'marketing', 'cart', 'modern', 
'{customerName,cartItems,cartTotal,checkoutUrl,expiryDays,businessName,businessAddress}', true),

('abandoned_cart_bold', 'Abandoned Cart Recovery - Bold', '🚨 CART EMERGENCY! ACT NOW!', 
'<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Abandoned Cart</title>
    <style>
        body { font-family: "Arial Black", Arial, sans-serif; line-height: 1.5; color: #000; margin: 0; padding: 0; background: #ffff00; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 0; overflow: hidden; border: 5px solid #000; }
        .header { background: #000; color: #ffff00; padding: 30px; text-align: center; }
        .content { padding: 30px; background: white; }
        .emergency-alert { background: #ff0000; color: white; padding: 20px; margin: 20px 0; border: 3px solid #000; font-weight: bold; text-align: center; animation: blink 1s infinite; }
        .cart-box { background: #ffff00; color: #000; padding: 20px; border: 3px solid #000; margin: 20px 0; }
        .footer { background: #000; color: white; padding: 20px; text-align: center; font-weight: bold; }
        .mega-button { display: inline-block; background: #ff0000; color: white; padding: 20px 40px; text-decoration: none; border: 3px solid #000; margin: 20px 0; font-weight: bold; font-size: 18px; text-transform: uppercase; animation: pulse 2s infinite; }
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0.7; } }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        @media only screen and (max-width: 600px) { .container { margin: 10px; } .content, .header { padding: 20px; } .mega-button { padding: 15px 30px; font-size: 16px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 32px; text-transform: uppercase;">🚨 RED ALERT! 🚨</h1>
            <p style="margin: 10px 0 0 0; font-size: 20px;">CART ABANDONED!</p>
        </div>
        <div class="content">
            <div class="emergency-alert">
                <h2 style="margin: 0;">{{customerName}}, THIS IS URGENT!</h2>
            </div>
            <p style="font-size: 18px; font-weight: bold;">ATTENTION! Your cart is in CRITICAL CONDITION! These items won''t wait forever!</p>
            <div class="cart-box">
                <h3 style="margin: 0 0 15px 0; font-size: 24px;">⚡ RESCUE THESE ITEMS ⚡</h3>
                <p style="font-size: 16px; margin: 5px 0;">{{cartItems}}</p>
                <p style="font-size: 18px; margin: 10px 0 0 0;"><strong>TOTAL DAMAGE:</strong> {{cartTotal}}</p>
            </div>
            <div class="emergency-alert">
                ⏰ DEADLINE: {{expiryDays}} DAYS TO SAVE YOUR CART!
            </div>
            <p style="font-size: 16px; font-weight: bold;">LAST CHANCE! Don''t let these AMAZING deals slip away!</p>
            <a href="{{checkoutUrl}}" class="mega-button">💥 RESCUE MY CART NOW!</a>
        </div>
        <div class="footer">
            <p>{{businessName}} | CART RESCUE SPECIALISTS!</p>
        </div>
    </div>
</body>
</html>',
'🚨 RED ALERT! CART ABANDONED! 🚨

{{customerName}}, THIS IS URGENT!

ATTENTION! Your cart is in CRITICAL CONDITION! These items won''t wait forever!

⚡ RESCUE THESE ITEMS ⚡
{{cartItems}}
TOTAL DAMAGE: {{cartTotal}}

⏰ DEADLINE: {{expiryDays}} DAYS TO SAVE YOUR CART!

LAST CHANCE! Don''t let these AMAZING deals slip away!

RESCUE YOUR CART: {{checkoutUrl}}

{{businessName}} | CART RESCUE SPECIALISTS!', 
'marketing', 'cart', 'bold', 
'{customerName,cartItems,cartTotal,checkoutUrl,expiryDays,businessName,businessAddress}', true),

-- Welcome Series Templates
('welcome_series_clean', 'Welcome Email - Clean', 'Welcome to {{businessName}}!', 
'<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9f9f9; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #3b82f6; color: white; padding: 40px; text-align: center; }
        .content { padding: 40px; }
        .welcome-card { background: #eff6ff; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #3b82f6; }
        .footer { background: #f1f5f9; padding: 25px; text-align: center; color: #64748b; }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        @media only screen and (max-width: 600px) { .container { margin: 0; border-radius: 0; } .content, .header { padding: 25px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 32px;">Welcome to {{businessName}}! 🎉</h1>
            <p style="margin: 15px 0 0 0; font-size: 18px;">We''re thrilled to have you with us</p>
        </div>
        <div class="content">
            <p>Dear {{customerName}},</p>
            <p>Thank you for joining our community! We''re excited to help you discover amazing products and have a wonderful shopping experience.</p>
            <div class="welcome-card">
                <h3 style="margin: 0 0 15px 0;">🎁 Welcome Gift</h3>
                <p>As a thank you for joining us, enjoy <strong>{{discountAmount}}% off</strong> your first order!</p>
                <p><strong>Use code:</strong> {{discountCode}}</p>
                <p><small>Valid until {{discountExpiry}}</small></p>
            </div>
            <p>Here''s what you can expect from us:</p>
            <ul>
                <li>✅ High-quality products</li>
                <li>✅ Fast and reliable delivery</li>
                <li>✅ Excellent customer service</li>
                <li>✅ Exclusive member offers</li>
            </ul>
            <a href="{{shopUrl}}" class="button">Start Shopping</a>
            <p>If you have any questions, feel free to reach out to us anytime!</p>
        </div>
        <div class="footer">
            <p>{{businessName}} | {{businessAddress}}</p>
            <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>',
'Welcome to {{businessName}}! 🎉

Dear {{customerName}},

Thank you for joining our community! We''re excited to help you discover amazing products and have a wonderful shopping experience.

🎁 Welcome Gift:
Enjoy {{discountAmount}}% off your first order!
Use code: {{discountCode}}
Valid until: {{discountExpiry}}

What you can expect from us:
✅ High-quality products
✅ Fast and reliable delivery  
✅ Excellent customer service
✅ Exclusive member offers

Start shopping: {{shopUrl}}

If you have any questions, feel free to reach out anytime!

{{businessName}}
{{businessAddress}}

Unsubscribe: {{unsubscribeUrl}}', 
'transactional', 'welcome', 'clean', 
'{customerName,businessName,discountAmount,discountCode,discountExpiry,shopUrl,businessAddress,unsubscribeUrl}', true),

('welcome_series_modern', 'Welcome Email - Modern', '🎉 Welcome aboard, {{customerName}}!', 
'<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome</title>
    <style>
        body { font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.15); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 50px; text-align: center; position: relative; }
        .confetti { position: absolute; width: 100%; height: 100%; overflow: hidden; }
        .confetti::before, .confetti::after { content: "🎉"; position: absolute; font-size: 30px; animation: fall 3s linear infinite; }
        .confetti::before { left: 20%; animation-delay: 0s; }
        .confetti::after { right: 20%; animation-delay: 1s; }
        .content { padding: 50px; }
        .gift-card { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 30px; border-radius: 16px; margin: 30px 0; text-align: center; border: 2px dashed #f59e0b; }
        .features { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 30px 0; }
        .feature { background: #f8fafc; padding: 20px; border-radius: 12px; text-align: center; }
        .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; margin: 25px 0; font-weight: 600; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); }
        @keyframes fall { to { transform: translateY(100px) rotate(360deg); opacity: 0; } }
        @media only screen and (max-width: 600px) { .container { margin: 10px; border-radius: 16px; } .content, .header { padding: 30px; } .features { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="confetti"></div>
            <h1 style="margin: 0; font-size: 36px;">🎉 Welcome Aboard!</h1>
            <p style="margin: 15px 0 0 0; font-size: 20px;">{{customerName}}, you''re now part of something amazing</p>
        </div>
        <div class="content">
            <p style="font-size: 18px;">Hey {{customerName}}! 👋</p>
            <p>Welcome to the {{businessName}} family! We''re absolutely thrilled to have you on board and can''t wait to make your experience extraordinary.</p>
            <div class="gift-card">
                <h2 style="margin: 0 0 20px 0; color: #92400e;">🎁 Your Welcome Gift</h2>
                <div style="font-size: 48px; font-weight: bold; color: #92400e; margin: 15px 0;">{{discountAmount}}% OFF</div>
                <p style="font-size: 18px; margin: 15px 0;"><strong>Code: {{discountCode}}</strong></p>
                <p style="color: #92400e;">✨ Valid until {{discountExpiry}} ✨</p>
            </div>
            <h3>🌟 What makes us special:</h3>
            <div class="features">
                <div class="feature">
                    <div style="font-size: 32px; margin-bottom: 10px;">🚀</div>
                    <strong>Lightning Fast</strong>
                    <p style="margin: 5px 0 0 0; font-size: 14px;">Quick delivery</p>
                </div>
                <div class="feature">
                    <div style="font-size: 32px; margin-bottom: 10px;">💎</div>
                    <strong>Premium Quality</strong>
                    <p style="margin: 5px 0 0 0; font-size: 14px;">Only the best</p>
                </div>
                <div class="feature">
                    <div style="font-size: 32px; margin-bottom: 10px;">💬</div>
                    <strong>24/7 Support</strong>
                    <p style="margin: 5px 0 0 0; font-size: 14px;">We''re here for you</p>
                </div>
                <div class="feature">
                    <div style="font-size: 32px; margin-bottom: 10px;">🎯</div>
                    <strong>Exclusive Deals</strong>
                    <p style="margin: 5px 0 0 0; font-size: 14px;">Member perks</p>
                </div>
            </div>
            <p>Ready to dive in? Let''s get this party started! 🚀</p>
            <a href="{{shopUrl}}" class="button">🛍️ Explore Our Collection</a>
        </div>
        <div class="footer">
            <p>{{businessName}} | {{businessAddress}}</p>
            <p><a href="{{unsubscribeUrl}}" style="color: #6b7280;">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>',
'🎉 Welcome Aboard! You''re now part of something amazing

Hey {{customerName}}! 👋

Welcome to the {{businessName}} family! We''re absolutely thrilled to have you on board and can''t wait to make your experience extraordinary.

🎁 Your Welcome Gift:
{{discountAmount}}% OFF your first order!
Code: {{discountCode}}
✨ Valid until {{discountExpiry}} ✨

🌟 What makes us special:
🚀 Lightning Fast - Quick delivery
💎 Premium Quality - Only the best  
💬 24/7 Support - We''re here for you
🎯 Exclusive Deals - Member perks

Ready to dive in? Let''s get this party started! 🚀

Explore our collection: {{shopUrl}}

{{businessName}}
{{businessAddress}}

Unsubscribe: {{unsubscribeUrl}}', 
'transactional', 'welcome', 'modern', 
'{customerName,businessName,discountAmount,discountCode,discountExpiry,shopUrl,businessAddress,unsubscribeUrl}', true),

-- Promotional Templates
('promotional_flash_sale', 'Flash Sale Alert - Modern', '⚡ FLASH SALE: {{discountAmount}}% OFF Everything!', 
'<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flash Sale</title>
    <style>
        body { font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
        .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.25); }
        .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 40px; text-align: center; position: relative; overflow: hidden; }
        .lightning { position: absolute; font-size: 60px; opacity: 0.2; animation: flash 2s infinite; }
        .lightning:nth-child(1) { top: 10px; left: 10%; animation-delay: 0s; }
        .lightning:nth-child(2) { top: 20px; right: 15%; animation-delay: 0.5s; }
        .lightning:nth-child(3) { bottom: 10px; left: 20%; animation-delay: 1s; }
        .content { padding: 40px; }
        .countdown { background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); padding: 25px; border-radius: 16px; margin: 25px 0; text-align: center; border: 2px solid #ef4444; }
        .timer { display: flex; justify-content: space-around; margin: 20px 0; }
        .timer-unit { text-align: center; }
        .timer-number { font-size: 32px; font-weight: bold; color: #dc2626; }
        .timer-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
        .products { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 30px 0; }
        .product { background: #f9fafb; padding: 20px; border-radius: 12px; text-align: center; }
        .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; }
        .button { display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 18px 36px; text-decoration: none; border-radius: 12px; margin: 25px 0; font-weight: 700; font-size: 18px; text-transform: uppercase; box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4); animation: pulse 2s infinite; }
        @keyframes flash { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.8; } }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        @media only screen and (max-width: 600px) { .container { margin: 10px; border-radius: 16px; } .content, .header { padding: 25px; } .products { grid-template-columns: 1fr; } .timer { flex-wrap: wrap; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="lightning">⚡</div>
            <div class="lightning">⚡</div>
            <div class="lightning">⚡</div>
            <h1 style="margin: 0; font-size: 36px; z-index: 10; position: relative;">⚡ FLASH SALE ⚡</h1>
            <p style="margin: 15px 0 0 0; font-size: 24px; z-index: 10; position: relative;">{{discountAmount}}% OFF EVERYTHING!</p>
        </div>
        <div class="content">
            <p style="font-size: 20px; font-weight: 600; text-align: center;">🔥 {{customerName}}, this is HUGE! 🔥</p>
            <p style="text-align: center;">For the next few hours only, EVERYTHING in our store is {{discountAmount}}% off! This is our biggest sale of the year!</p>
            <div class="countdown">
                <h3 style="margin: 0 0 20px 0; color: #dc2626;">⏰ Sale Ends In:</h3>
                <div class="timer">
                    <div class="timer-unit">
                        <div class="timer-number">{{hoursLeft}}</div>
                        <div class="timer-label">Hours</div>
                    </div>
                    <div class="timer-unit">
                        <div class="timer-number">{{minutesLeft}}</div>
                        <div class="timer-label">Minutes</div>
                    </div>
                    <div class="timer-unit">
                        <div class="timer-number">{{secondsLeft}}</div>
                        <div class="timer-label">Seconds</div>
                    </div>
                </div>
                <p style="font-weight: 600; color: #dc2626;">Use code: <strong>{{discountCode}}</strong></p>
            </div>
            <h3 style="text-align: center;">🌟 Featured Deals:</h3>
            <div class="products">
                <div class="product">
                    <div style="font-size: 48px; margin-bottom: 10px;">👕</div>
                    <strong>Fashion</strong>
                    <p style="margin: 5px 0; color: #dc2626;">From ${{fashionPrice}}</p>
                </div>
                <div class="product">
                    <div style="font-size: 48px; margin-bottom: 10px;">📱</div>
                    <strong>Electronics</strong>
                    <p style="margin: 5px 0; color: #dc2626;">From ${{electronicsPrice}}</p>
                </div>
                <div class="product">
                    <div style="font-size: 48px; margin-bottom: 10px;">🏠</div>
                    <strong>Home & Garden</strong>
                    <p style="margin: 5px 0; color: #dc2626;">From ${{homePrice}}</p>
                </div>
                <div class="product">
                    <div style="font-size: 48px; margin-bottom: 10px;">🎮</div>
                    <strong>Gaming</strong>
                    <p style="margin: 5px 0; color: #dc2626;">From ${{gamingPrice}}</p>
                </div>
            </div>
            <p style="text-align: center; font-weight: 600;">⚠️ Warning: This sale is so good, items are flying off the shelves!</p>
            <div style="text-align: center;">
                <a href="{{shopUrl}}" class="button">🛒 Shop Now & Save Big!</a>
            </div>
        </div>
        <div class="footer">
            <p>{{businessName}} | {{businessAddress}}</p>
            <p><a href="{{unsubscribeUrl}}" style="color: #6b7280;">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>',
'⚡ FLASH SALE: {{discountAmount}}% OFF EVERYTHING! ⚡

🔥 {{customerName}}, this is HUGE! 🔥

For the next few hours only, EVERYTHING in our store is {{discountAmount}}% off! This is our biggest sale of the year!

⏰ Sale Ends In: {{hoursLeft}} hours, {{minutesLeft}} minutes!
Use code: {{discountCode}}

🌟 Featured Deals:
👕 Fashion - From ${{fashionPrice}}
📱 Electronics - From ${{electronicsPrice}}  
🏠 Home & Garden - From ${{homePrice}}
🎮 Gaming - From ${{gamingPrice}}

⚠️ Warning: This sale is so good, items are flying off the shelves!

Shop now: {{shopUrl}}

{{businessName}}
{{businessAddress}}

Unsubscribe: {{unsubscribeUrl}}', 
'marketing', 'promotional', 'modern', 
'{customerName,discountAmount,discountCode,hoursLeft,minutesLeft,secondsLeft,fashionPrice,electronicsPrice,homePrice,gamingPrice,shopUrl,businessName,businessAddress,unsubscribeUrl}', true)

ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  template_type = EXCLUDED.template_type,
  category = EXCLUDED.category,
  style = EXCLUDED.style,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();