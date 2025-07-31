export interface EmailTemplate {
  template_key: string;
  template_name: string;
  subject_template: string;
  html_template: string;
  text_template: string;
  template_type: 'transactional' | 'marketing' | 'notification';
  category: 'order' | 'shipping' | 'cart' | 'welcome' | 'promotional';
  style: 'clean' | 'modern' | 'bold' | 'elegant';
  variables: string[];
  is_active: boolean;
}

export const professionalEmailTemplates: EmailTemplate[] = [
  // ===== ORDER CONFIRMATION TEMPLATES =====
  {
    template_key: 'order_confirmation_clean',
    template_name: 'Order Confirmation - Clean Style',
    subject_template: 'Order Confirmation #{{orderId}} - Thank You!',
    category: 'order',
    style: 'clean',
    template_type: 'transactional',
    variables: ['orderId', 'customerName', 'orderDate', 'orderItems', 'orderTotal', 'deliveryAddress', 'companyName', 'supportEmail'],
    is_active: true,
    text_template: `Dear {{customerName}},

Thank you for your order! Your order #{{orderId}} has been confirmed.

Order Date: {{orderDate}}
Order Total: {{orderTotal}}

Your order will be delivered to:
{{deliveryAddress}}

We'll keep you updated on your delivery status.

Thank you for choosing {{companyName}}!

If you have any questions, please contact us at {{supportEmail}}.

Best regards,
The {{companyName}} Team`,
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background-color: #ffffff; padding: 32px 24px; border-bottom: 1px solid #e5e7eb; text-align: center; }
        .logo { font-size: 24px; font-weight: 700; color: #1f2937; }
        .content { padding: 32px 24px; }
        .order-header { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px; }
        .order-number { font-size: 20px; font-weight: 600; color: #1f2937; margin-bottom: 8px; }
        .order-date { color: #6b7280; }
        .section { margin-bottom: 24px; }
        .section-title { font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 12px; }
        .order-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
        .order-item:last-child { border-bottom: none; }
        .item-name { font-weight: 500; color: #1f2937; }
        .item-price { font-weight: 600; color: #1f2937; }
        .total-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-top: 2px solid #e5e7eb; margin-top: 16px; }
        .total-label { font-size: 18px; font-weight: 700; color: #1f2937; }
        .total-amount { font-size: 18px; font-weight: 700; color: #059669; }
        .address-box { background-color: #f9fafb; padding: 16px; border-radius: 6px; border-left: 4px solid #10b981; }
        .footer { background-color: #f9fafb; padding: 24px; text-align: center; color: #6b7280; font-size: 14px; }
        .support-link { color: #059669; text-decoration: none; }
        @media (max-width: 600px) {
            .container { margin: 0; }
            .content { padding: 24px 16px; }
            .header { padding: 24px 16px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">{{companyName}}</div>
        </div>
        
        <div class="content">
            <div class="order-header">
                <div class="order-number">Order #{{orderId}}</div>
                <div class="order-date">Placed on {{orderDate}}</div>
            </div>
            
            <p style="margin-bottom: 24px; color: #374151;">Hi {{customerName}},</p>
            <p style="margin-bottom: 24px; color: #374151;">Thank you for your order! We've received your order and it's being processed.</p>
            
            <div class="section">
                <div class="section-title">Order Summary</div>
                <div>{{orderItems}}</div>
                <div class="total-row">
                    <span class="total-label">Total</span>
                    <span class="total-amount">{{orderTotal}}</span>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">Delivery Address</div>
                <div class="address-box">{{deliveryAddress}}</div>
            </div>
            
            <p style="color: #374151;">We'll send you tracking information once your order ships.</p>
        </div>
        
        <div class="footer">
            <p>Need help? Contact us at <a href="mailto:{{supportEmail}}" class="support-link">{{supportEmail}}</a></p>
            <p style="margin-top: 8px;">© {{companyName}}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`
  },

  {
    template_key: 'order_confirmation_modern',
    template_name: 'Order Confirmation - Modern Style',
    subject_template: '✅ Your order is confirmed! #{{orderId}}',
    category: 'order',
    style: 'modern',
    template_type: 'transactional',
    variables: [
      'orderId',
      'customerName',
      'orderDate',
      'orderItems',
      'orderTotal',
      'companyName',
      'supportEmail'
    ],
    is_active: true,
    text_template: `Hi {{customerName}}! 🎉

Your order #{{orderId}} is confirmed and we're getting it ready for you!

Order Details:
- Order Date: {{orderDate}}
- Total: {{orderTotal}}

{{orderItems}}

We'll notify you as soon as it ships!

Questions? Reply to this email or contact {{supportEmail}}

Thanks for choosing {{companyName}}!`,
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #1a202c; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 24px; text-align: center; color: white; }
        .logo { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
        .header-subtitle { opacity: 0.9; font-size: 16px; }
        .content { padding: 40px 24px; }
        .success-icon { width: 64px; height: 64px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; }
        .order-card { background: linear-gradient(135deg, #f8fafc, #e2e8f0); border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0; }
        .order-number { font-size: 24px; font-weight: 700; color: #2d3748; margin-bottom: 8px; }
        .order-date { color: #718096; font-size: 14px; }
        .section { margin: 32px 0; }
        .section-title { font-size: 18px; font-weight: 700; color: #2d3748; margin-bottom: 16px; display: flex; align-items: center; }
        .section-icon { margin-right: 8px; }
        .items-container { background-color: #f7fafc; border-radius: 12px; padding: 20px; }
        .total-card { background: linear-gradient(135deg, #2d3748, #4a5568); color: white; border-radius: 12px; padding: 20px; text-align: center; }
        .total-amount { font-size: 28px; font-weight: 800; }
        .footer { background-color: #f8fafc; padding: 32px 24px; text-align: center; color: #718096; }
        .support-button { display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 12px 24px; border-radius: 25px; text-decoration: none; font-weight: 600; margin-top: 16px; }
        @media (max-width: 600px) {
            .container { margin: 20px; border-radius: 12px; }
            .content { padding: 24px 16px; }
            .header { padding: 32px 16px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">{{companyName}}</div>
            <div class="header-subtitle">Your order is confirmed!</div>
        </div>
        
        <div class="content">
            <div class="success-icon">✅</div>
            
            <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #2d3748; margin-bottom: 8px;">Thanks {{customerName}}!</h1>
                <p style="color: #718096;">We've received your order and it's being processed with care.</p>
            </div>
            
            <div class="order-card">
                <div class="order-number">Order #{{orderId}}</div>
                <div class="order-date">{{orderDate}}</div>
            </div>
            
            <div class="section">
                <div class="section-title">
                    <span class="section-icon">📦</span>
                    Your Items
                </div>
                <div class="items-container">
                    {{orderItems}}
                </div>
            </div>
            
            <div class="total-card">
                <div style="margin-bottom: 8px; opacity: 0.8;">Order Total</div>
                <div class="total-amount">{{orderTotal}}</div>
            </div>
            
            <div style="text-align: center; margin-top: 32px;">
                <p style="color: #4a5568; margin-bottom: 16px;">We'll send you updates as your order progresses!</p>
            </div>
        </div>
        
        <div class="footer">
            <p>Questions about your order?</p>
            <a href="mailto:{{supportEmail}}" class="support-button">Contact Support</a>
            <p style="margin-top: 24px; font-size: 12px;">© {{companyName}}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`
  },

  {
    template_key: 'order_confirmation_bold',
    template_name: 'Order Confirmation - Bold Style',
    subject_template: '🔥 ORDER CONFIRMED: #{{orderId}} - {{companyName}}',
    category: 'order',
    style: 'bold',
    template_type: 'transactional',
    variables: ['orderId', 'customerName', 'orderDate', 'orderTotal', 'companyName', 'supportEmail'],
    is_active: true,
    text_template: `🔥 ORDER CONFIRMED! 🔥

{{customerName}}, YOUR ORDER IS LOCKED IN!

Order #{{orderId}}
Date: {{orderDate}}
Total: {{orderTotal}}

WE'RE PREPARING YOUR ORDER RIGHT NOW!

Get ready for an amazing delivery experience with {{companyName}}!

Questions? Hit us up: {{supportEmail}}

LET'S GO! 🚀`,
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmed!</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial Black', Arial, sans-serif; line-height: 1.4; background: linear-gradient(45deg, #ff6b6b, #ee5a52, #ff8a80); color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a, #2d2d2d); }
        .header { background: linear-gradient(135deg, #ff6b6b, #ee5a52); padding: 40px 20px; text-align: center; position: relative; overflow: hidden; }
        .header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.1)"/><circle cx="80" cy="80" r="2" fill="rgba(255,255,255,0.1)"/><circle cx="40" cy="60" r="1" fill="rgba(255,255,255,0.1)"/></svg>'); }
        .logo { font-size: 32px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; position: relative; z-index: 1; }
        .fire-emoji { font-size: 48px; margin: 16px 0; }
        .content { padding: 40px 24px; color: #ffffff; }
        .big-title { font-size: 36px; font-weight: 900; text-transform: uppercase; text-align: center; margin-bottom: 24px; color: #ff6b6b; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); letter-spacing: 1px; }
        .order-box { background: linear-gradient(135deg, #ff6b6b, #ee5a52); padding: 24px; border-radius: 12px; margin: 24px 0; text-align: center; border: 3px solid #ffffff; box-shadow: 0 8px 16px rgba(0,0,0,0.3); }
        .order-number { font-size: 28px; font-weight: 900; margin-bottom: 8px; }
        .order-details { font-size: 18px; font-weight: 700; }
        .status-banner { background: #00ff88; color: #000000; padding: 16px; text-align: center; font-weight: 900; font-size: 20px; margin: 24px 0; border-radius: 8px; text-transform: uppercase; letter-spacing: 1px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #00ff88, #00cc6a); color: #000000; padding: 16px 32px; border-radius: 50px; text-decoration: none; font-weight: 900; font-size: 18px; margin: 16px 0; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); }
        .footer { background: #000000; padding: 24px; text-align: center; }
        .footer-text { color: #cccccc; font-size: 14px; }
        @media (max-width: 600px) {
            .big-title { font-size: 28px; }
            .content { padding: 24px 16px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="fire-emoji">🔥</div>
            <div class="logo">{{companyName}}</div>
            <div class="fire-emoji">🔥</div>
        </div>
        
        <div class="content">
            <div class="big-title">ORDER CONFIRMED!</div>
            
            <div style="text-align: center; margin-bottom: 32px;">
                <div style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">{{customerName}}, YOU'RE ALL SET!</div>
                <div style="font-size: 18px; opacity: 0.9;">Your order is locked in and we're getting it ready!</div>
            </div>
            
            <div class="order-box">
                <div class="order-number">ORDER #{{orderId}}</div>
                <div class="order-details">{{orderDate}}</div>
                <div class="order-details" style="font-size: 24px; margin-top: 12px;">{{orderTotal}}</div>
            </div>
            
            <div class="status-banner">
                🚀 PREPARING YOUR ORDER NOW! 🚀
            </div>
            
            <div style="text-align: center;">
                <p style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Get ready for an AMAZING delivery experience!</p>
                <a href="mailto:{{supportEmail}}" class="cta-button">NEED HELP? CONTACT US!</a>
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-text">© {{companyName}} - Delivering Excellence</div>
        </div>
    </div>
</body>
</html>`
  },

  {
    template_key: 'order_confirmation_elegant',
    template_name: 'Order Confirmation - Elegant Style',
    subject_template: 'Your Order Confirmation — {{companyName}}',
    category: 'order',
    style: 'elegant',
    template_type: 'transactional',
    variables: ['orderId', 'customerName', 'orderDate', 'orderItems', 'orderTotal', 'deliveryAddress', 'companyName', 'supportEmail'],
    is_active: true,
    text_template: `Dear {{customerName}},

We are delighted to confirm that your order has been received and is currently being prepared with the utmost care.

Order Details:
Order Number: {{orderId}}
Order Date: {{orderDate}}
Order Total: {{orderTotal}}

Delivery Address:
{{deliveryAddress}}

Your order contains:
{{orderItems}}

We will keep you informed of your order's progress and notify you once it has been dispatched.

Should you require any assistance, please do not hesitate to contact our customer service team at {{supportEmail}}.

With warm regards,
The {{companyName}} Team`,
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Georgia', 'Times New Roman', serif; line-height: 1.8; color: #2c3e50; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #2c3e50, #34495e); padding: 48px 32px; text-align: center; color: #ffffff; position: relative; }
        .header::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, #ecf0f1, transparent); }
        .logo { font-size: 32px; font-weight: 300; letter-spacing: 3px; margin-bottom: 8px; }
        .tagline { font-size: 14px; opacity: 0.8; font-style: italic; letter-spacing: 1px; }
        .content { padding: 48px 32px; }
        .greeting { font-size: 18px; color: #2c3e50; margin-bottom: 32px; }
        .order-details { background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 0; padding: 32px; margin: 32px 0; position: relative; }
        .order-details::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: linear-gradient(180deg, #3498db, #2980b9); }
        .order-number { font-size: 24px; font-weight: 400; color: #2c3e50; margin-bottom: 16px; letter-spacing: 1px; }
        .order-meta { color: #7f8c8d; font-size: 16px; margin-bottom: 24px; }
        .section-divider { height: 1px; background: linear-gradient(90deg, transparent, #bdc3c7, transparent); margin: 32px 0; }
        .items-section { margin: 32px 0; }
        .section-title { font-size: 18px; font-weight: 400; color: #2c3e50; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 2px; }
        .total-section { background: linear-gradient(135deg, #ecf0f1, #d5dbdb); padding: 24px; margin: 32px 0; text-align: center; }
        .total-label { font-size: 16px; color: #7f8c8d; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
        .total-amount { font-size: 28px; font-weight: 400; color: #2c3e50; }
        .address-section { background-color: #f8f9fa; padding: 24px; border-left: 4px solid #3498db; margin: 24px 0; }
        .footer { background-color: #2c3e50; color: #ecf0f1; padding: 32px; text-align: center; }
        .footer-text { font-size: 14px; line-height: 1.6; }
        .support-link { color: #3498db; text-decoration: none; }
        .signature { font-style: italic; margin-top: 32px; color: #7f8c8d; }
        @media (max-width: 600px) {
            .container { margin: 20px; }
            .content { padding: 32px 20px; }
            .header { padding: 32px 20px; }
            .order-details { padding: 24px 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">{{companyName}}</div>
            <div class="tagline">Excellence in Every Detail</div>
        </div>
        
        <div class="content">
            <div class="greeting">Dear {{customerName}},</div>
            
            <p style="margin-bottom: 24px; color: #34495e;">We are delighted to confirm that your order has been received and is currently being prepared with the utmost care and attention to detail.</p>
            
            <div class="order-details">
                <div class="order-number">Order №{{orderId}}</div>
                <div class="order-meta">Placed on {{orderDate}}</div>
                
                <div class="section-divider"></div>
                
                <div class="items-section">
                    <div class="section-title">Order Summary</div>
                    {{orderItems}}
                </div>
                
                <div class="total-section">
                    <div class="total-label">Order Total</div>
                    <div class="total-amount">{{orderTotal}}</div>
                </div>
            </div>
            
            <div class="section-title">Delivery Information</div>
            <div class="address-section">
                {{deliveryAddress}}
            </div>
            
            <p style="color: #34495e; margin: 32px 0;">We will keep you informed of your order's progress and will notify you promptly once your items have been carefully packaged and dispatched.</p>
            
            <div class="signature">
                With warm regards,<br>
                The {{companyName}} Team
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-text">
                Should you require any assistance, please do not hesitate to contact our dedicated customer service team at <a href="mailto:{{supportEmail}}" class="support-link">{{supportEmail}}</a>
            </div>
            <div style="margin-top: 20px; font-size: 12px; opacity: 0.7;">
                © {{companyName}} — Crafted with Excellence
            </div>
        </div>
    </div>
</body>
</html>`
  },

  // ===== SHIPPING TEMPLATES =====
  {
    template_key: 'order_shipped',
    template_name: 'Order Shipped Notification',
    subject_template: '📦 Your order #{{orderId}} is on its way!',
    category: 'shipping',
    style: 'modern',
    template_type: 'notification',
    variables: ['orderId', 'customerName', 'trackingNumber', 'carrierName', 'estimatedDelivery', 'trackingUrl', 'companyName'],
    is_active: true,
    text_template: `Hi {{customerName}}!

Great news! Your order #{{orderId}} has shipped and is on its way to you.

Tracking Information:
- Tracking Number: {{trackingNumber}}
- Carrier: {{carrierName}}
- Estimated Delivery: {{estimatedDelivery}}

Track your package: {{trackingUrl}}

Thanks for choosing {{companyName}}!`,
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Shipped</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #1a202c; background-color: #f7fafc; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #4299e1, #3182ce); padding: 32px 24px; text-align: center; color: white; }
        .truck-icon { font-size: 48px; margin-bottom: 16px; }
        .content { padding: 32px 24px; }
        .tracking-card { background: linear-gradient(135deg, #ebf8ff, #bee3f8); border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #4299e1; }
        .track-button { display: inline-block; background: linear-gradient(135deg, #4299e1, #3182ce); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
        .delivery-info { background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="truck-icon">🚚</div>
            <h1 style="font-size: 24px; margin-bottom: 8px;">Your Order is On Its Way!</h1>
            <p style="opacity: 0.9;">{{companyName}}</p>
        </div>
        
        <div class="content">
            <p style="font-size: 18px; margin-bottom: 24px;">Hi {{customerName}},</p>
            <p style="margin-bottom: 24px;">Great news! Your order #{{orderId}} has been shipped and is heading your way.</p>
            
            <div class="tracking-card">
                <h3 style="color: #2d3748; margin-bottom: 16px;">Tracking Information</h3>
                <p><strong>Tracking Number:</strong> {{trackingNumber}}</p>
                <p><strong>Carrier:</strong> {{carrierName}}</p>
                <p><strong>Estimated Delivery:</strong> {{estimatedDelivery}}</p>
                <a href="{{trackingUrl}}" class="track-button">Track Your Package</a>
            </div>
            
            <div class="delivery-info">
                <p style="color: #4a5568;">We'll send you another update when your package is out for delivery!</p>
            </div>
        </div>
    </div>
</body>
</html>`
  },

  {
    template_key: 'out_for_delivery',
    template_name: 'Out for Delivery',
    subject_template: '🚚 Your order #{{orderId}} is out for delivery!',
    category: 'shipping',
    style: 'modern',
    template_type: 'notification',
    variables: ['orderId', 'customerName', 'deliveryTimeframe', 'deliveryAddress', 'companyName'],
    is_active: true,
    text_template: `{{customerName}}, your package is almost there!

Your order #{{orderId}} is out for delivery and should arrive within {{deliveryTimeframe}}.

Delivery Address:
{{deliveryAddress}}

Please ensure someone is available to receive the package.

Thank you for choosing {{companyName}}!`,
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Out for Delivery</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #1a202c; background-color: #f7fafc; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #ed8936, #dd6b20); padding: 32px 24px; text-align: center; color: white; }
        .content { padding: 32px 24px; }
        .delivery-alert { background: linear-gradient(135deg, #fef5e7, #fed7aa); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; border-left: 4px solid #ed8936; }
        .address-box { background-color: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4299e1; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="font-size: 48px; margin-bottom: 16px;">🚚</div>
            <h1>Almost There!</h1>
            <p>Your package is out for delivery</p>
        </div>
        
        <div class="content">
            <p style="font-size: 18px; margin-bottom: 24px;">Hi {{customerName}},</p>
            
            <div class="delivery-alert">
                <h2 style="color: #744210; margin-bottom: 12px;">Your Order #{{orderId}} is Out for Delivery!</h2>
                <p style="color: #744210; font-size: 18px;">Expected within {{deliveryTimeframe}}</p>
            </div>
            
            <div style="margin: 24px 0;">
                <h3 style="color: #2d3748; margin-bottom: 12px;">Delivery Address:</h3>
                <div class="address-box">{{deliveryAddress}}</div>
            </div>
            
            <p style="color: #4a5568;">Please ensure someone is available to receive your package. If you're not available, the driver may leave it in a safe location or attempt delivery another time.</p>
        </div>
    </div>
</body>
</html>`
  },

  {
    template_key: 'package_delivered',
    template_name: 'Package Delivered',
    subject_template: '✅ Your order #{{orderId}} has been delivered!',
    category: 'shipping',
    style: 'clean',
    template_type: 'notification',
    variables: ['orderId', 'customerName', 'deliveryTime', 'deliveryLocation', 'companyName', 'reviewUrl'],
    is_active: true,
    text_template: `Hi {{customerName}}!

Your order #{{orderId}} has been successfully delivered!

Delivery Details:
- Time: {{deliveryTime}}
- Location: {{deliveryLocation}}

We hope you love your purchase! If you have a moment, we'd appreciate your feedback: {{reviewUrl}}

Thank you for choosing {{companyName}}!`,
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Package Delivered</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #1a202c; background-color: #f7fafc; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #48bb78, #38a169); padding: 40px 24px; text-align: center; color: white; }
        .content { padding: 32px 24px; }
        .success-card { background: linear-gradient(135deg, #f0fff4, #c6f6d5); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; border-left: 4px solid #48bb78; }
        .review-button { display: inline-block; background: linear-gradient(135deg, #48bb78, #38a169); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="font-size: 64px; margin-bottom: 16px;">📦✅</div>
            <h1>Delivered Successfully!</h1>
            <p>{{companyName}}</p>
        </div>
        
        <div class="content">
            <p style="font-size: 18px; margin-bottom: 24px;">Hi {{customerName}},</p>
            
            <div class="success-card">
                <h2 style="color: #22543d; margin-bottom: 16px;">Your Order #{{orderId}} Has Been Delivered!</h2>
                <p style="color: #22543d;"><strong>Time:</strong> {{deliveryTime}}</p>
                <p style="color: #22543d;"><strong>Location:</strong> {{deliveryLocation}}</p>
            </div>
            
            <p style="margin: 24px 0;">We hope you love your purchase! Your satisfaction is our top priority.</p>
            
            <div style="text-align: center; margin: 32px 0;">
                <p style="margin-bottom: 16px;">How was your experience?</p>
                <a href="{{reviewUrl}}" class="review-button">Leave a Review</a>
            </div>
        </div>
    </div>
</body>
</html>`
  },

  // ===== ABANDONED CART TEMPLATES =====
  {
    template_key: 'cart_reminder_initial',
    template_name: 'Abandoned Cart - Initial Reminder',
    subject_template: 'You left something behind! 🛒',
    category: 'cart',
    style: 'clean',
    template_type: 'marketing',
    variables: ['customerName', 'cartItems', 'cartTotal', 'cartUrl', 'companyName'],
    is_active: true,
    text_template: `Hi {{customerName}},

We noticed you left some items in your cart. Don't worry, we've saved them for you!

Your cart contains:
{{cartItems}}

Total: {{cartTotal}}

Complete your purchase: {{cartUrl}}

Need help? Just reply to this email.

Thanks,
{{companyName}}`,
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You left something behind</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #374151; background-color: #f9fafb; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .header { background-color: #ffffff; padding: 32px 24px; text-align: center; border-bottom: 1px solid #e5e7eb; }
        .cart-icon { font-size: 48px; margin-bottom: 16px; }
        .content { padding: 32px 24px; }
        .cart-items { background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0; }
        .checkout-button { display: inline-block; background-color: #3b82f6; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 24px; }
        .total-amount { font-size: 20px; font-weight: 700; color: #1f2937; margin-top: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="cart-icon">🛒</div>
            <h1 style="color: #1f2937; margin-bottom: 8px;">You left something behind!</h1>
            <p style="color: #6b7280;">{{companyName}}</p>
        </div>
        
        <div class="content">
            <p style="margin-bottom: 24px;">Hi {{customerName}},</p>
            <p style="margin-bottom: 24px;">We noticed you left some great items in your cart. Don't worry, we've saved them for you!</p>
            
            <div class="cart-items">
                <h3 style="color: #374151; margin-bottom: 16px;">Your saved items:</h3>
                {{cartItems}}
                <div class="total-amount">Total: {{cartTotal}}</div>
            </div>
            
            <p>Ready to complete your purchase?</p>
            
            <div style="text-align: center;">
                <a href="{{cartUrl}}" class="checkout-button">Complete My Purchase</a>
            </div>
            
            <p style="margin-top: 32px; color: #6b7280; font-size: 14px;">Need help? Just reply to this email and we'll be happy to assist you.</p>
        </div>
    </div>
</body>
</html>`
  },

  {
    template_key: 'cart_reminder_discount',
    template_name: 'Abandoned Cart - With Discount',
    subject_template: "Still thinking? Here's {{discountAmount}} off! 💰",
    category: 'cart',
    style: 'modern',
    template_type: 'marketing',
    variables: ['customerName', 'cartItems', 'cartTotal', 'discountAmount', 'discountCode', 'cartUrl', 'companyName'],
    is_active: true,
    text_template: `{{customerName}}, we have a special offer for you!

Your cart is still waiting, and to sweeten the deal, here's {{discountAmount}} off your order!

Use code: {{discountCode}}

Your cart:
{{cartItems}}
Total: {{cartTotal}}
Discount: {{discountAmount}}

Complete your purchase: {{cartUrl}}

This offer won't last long!

{{companyName}}`,
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Special Discount Just for You</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #1a202c; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 24px; text-align: center; color: white; }
        .discount-badge { background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 16px; }
        .content { padding: 32px 24px; }
        .discount-box { background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
        .discount-code { background: rgba(255,255,255,0.2); padding: 12px 20px; border-radius: 8px; font-family: monospace; font-size: 18px; font-weight: bold; margin: 16px 0; }
        .cart-summary { background-color: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; }
        .checkout-button { display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; }
        .urgency-text { color: #e53e3e; font-weight: 600; text-align: center; margin: 16px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="discount-badge">Special Offer 💰</div>
            <h1 style="margin-bottom: 8px;">{{discountAmount}} Off Just for You!</h1>
            <p style="opacity: 0.9;">{{companyName}}</p>
        </div>
        
        <div class="content">
            <p style="font-size: 18px; margin-bottom: 24px;">Hi {{customerName}},</p>
            <p style="margin-bottom: 24px;">We noticed your cart is still waiting, so we wanted to sweeten the deal for you!</p>
            
            <div class="discount-box">
                <h2 style="margin-bottom: 12px;">Your Exclusive Discount</h2>
                <div style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">{{discountAmount}} OFF</div>
                <div style="margin-bottom: 8px;">Use code:</div>
                <div class="discount-code">{{discountCode}}</div>
            </div>
            
            <div class="cart-summary">
                <h3 style="color: #2d3748; margin-bottom: 16px;">Your Cart:</h3>
                {{cartItems}}
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Subtotal:</span>
                        <span>{{cartTotal}}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; color: #48bb78; font-weight: 600;">
                        <span>Discount:</span>
                        <span>-{{discountAmount}}</span>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center;">
                <a href="{{cartUrl}}" class="checkout-button">Complete Purchase with Discount</a>
            </div>
            
            <div class="urgency-text">⏰ This exclusive offer won't last long!</div>
        </div>
    </div>
</body>
</html>`
  },

  {
    template_key: 'cart_reminder_final',
    template_name: 'Abandoned Cart - Final Attempt',
    subject_template: 'Last chance! Your cart expires soon ⏰',
    category: 'cart',
    style: 'bold',
    template_type: 'marketing',
    variables: ['customerName', 'cartItems', 'cartTotal', 'expiryDate', 'cartUrl', 'companyName'],
    is_active: true,
    text_template: `{{customerName}} - FINAL NOTICE!

Your cart will expire on {{expiryDate}}!

Don't miss out on:
{{cartItems}}

Total Value: {{cartTotal}}

SAVE YOUR CART NOW: {{cartUrl}}

This is your last chance - act fast!

{{companyName}}`,
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Last Chance - Cart Expires Soon</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial Black', Arial, sans-serif; line-height: 1.4; background: linear-gradient(45deg, #ff4757, #ff3838); color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a, #2d2d2d); }
        .header { background: linear-gradient(135deg, #ff4757, #ff3838); padding: 40px 20px; text-align: center; position: relative; }
        .warning-icon { font-size: 64px; margin-bottom: 16px; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        .content { padding: 40px 24px; }
        .urgent-banner { background: linear-gradient(45deg, #ffa502, #ff6348); color: #000000; padding: 16px; text-align: center; font-weight: 900; font-size: 18px; margin: 24px 0; border-radius: 8px; text-transform: uppercase; }
        .cart-box { background: rgba(255,255,255,0.1); border: 2px solid #ff4757; padding: 24px; border-radius: 12px; margin: 24px 0; }
        .expiry-warning { background: #ff4757; color: #ffffff; padding: 20px; text-align: center; font-weight: 900; font-size: 20px; margin: 24px 0; border-radius: 8px; }
        .save-button { display: inline-block; background: linear-gradient(135deg, #2ed573, #1e90ff); color: #ffffff; padding: 20px 40px; border-radius: 50px; text-decoration: none; font-weight: 900; font-size: 20px; text-transform: uppercase; margin: 20px 0; box-shadow: 0 4px 8px rgba(0,0,0,0.3); }
        .final-notice { background: #000000; color: #ff4757; padding: 16px; text-align: center; font-weight: 900; font-size: 16px; border-radius: 8px; margin: 24px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="warning-icon">⚠️</div>
            <h1 style="font-size: 28px; font-weight: 900; text-transform: uppercase; margin-bottom: 8px;">FINAL NOTICE</h1>
            <p style="font-size: 18px;">{{companyName}}</p>
        </div>
        
        <div class="content">
            <div style="text-align: center; margin-bottom: 32px;">
                <h2 style="font-size: 24px; font-weight: 900; margin-bottom: 16px;">{{customerName}}, DON'T LOSE YOUR ITEMS!</h2>
            </div>
            
            <div class="expiry-warning">
                ⏰ YOUR CART EXPIRES ON {{expiryDate}} ⏰
            </div>
            
            <div class="cart-box">
                <h3 style="color: #ff4757; margin-bottom: 16px; font-size: 20px;">YOUR SAVED ITEMS:</h3>
                {{cartItems}}
                <div style="margin-top: 20px; font-size: 24px; font-weight: 900; color: #2ed573;">
                    TOTAL VALUE: {{cartTotal}}
                </div>
            </div>
            
            <div class="urgent-banner">
                🚨 THIS IS YOUR LAST CHANCE! 🚨
            </div>
            
            <div style="text-align: center;">
                <a href="{{cartUrl}}" class="save-button">SAVE MY CART NOW!</a>
            </div>
            
            <div class="final-notice">
                ACT FAST - ONCE IT'S GONE, IT'S GONE!
            </div>
        </div>
    </div>
</body>
</html>`
  },

  // ===== WELCOME TEMPLATES =====
  {
    template_key: 'welcome_new_customer',
    template_name: 'Welcome New Customer',
    subject_template: 'Welcome to {{companyName}}! 🎉',
    category: 'welcome',
    style: 'modern',
    template_type: 'marketing',
    variables: ['customerName', 'companyName', 'shopUrl', 'supportEmail'],
    is_active: true,
    text_template: `Welcome {{customerName}}! 🎉

We're thrilled to have you join the {{companyName}} family!

Get ready to discover amazing products and exclusive offers just for you.

Start shopping: {{shopUrl}}

Questions? We're here to help: {{supportEmail}}

Welcome aboard!
The {{companyName}} Team`,
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to {{companyName}}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #1a202c; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #48bb78, #38a169); padding: 48px 24px; text-align: center; color: white; }
        .welcome-icon { font-size: 64px; margin-bottom: 24px; }
        .content { padding: 40px 24px; text-align: center; }
        .welcome-card { background: linear-gradient(135deg, #f0fff4, #c6f6d5); border-radius: 12px; padding: 32px 24px; margin: 32px 0; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 24px 0; }
        .benefits { text-align: left; margin: 32px 0; }
        .benefit-item { display: flex; align-items: center; margin: 16px 0; }
        .benefit-icon { font-size: 24px; margin-right: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="welcome-icon">🎉</div>
            <h1 style="font-size: 32px; margin-bottom: 16px;">Welcome to {{companyName}}!</h1>
            <p style="font-size: 18px; opacity: 0.9;">We're excited to have you here</p>
        </div>
        
        <div class="content">
            <h2 style="color: #2d3748; margin-bottom: 16px;">Hi {{customerName}}!</h2>
            <p style="font-size: 18px; color: #4a5568; margin-bottom: 32px;">Welcome to our community! We're thrilled to have you join the {{companyName}} family.</p>
            
            <div class="welcome-card">
                <h3 style="color: #22543d; margin-bottom: 16px;">What you can expect:</h3>
                <div class="benefits">
                    <div class="benefit-item">
                        <span class="benefit-icon">✨</span>
                        <span>Exclusive products and collections</span>
                    </div>
                    <div class="benefit-item">
                        <span class="benefit-icon">🎁</span>
                        <span>Special member-only offers</span>
                    </div>
                    <div class="benefit-item">
                        <span class="benefit-icon">🚚</span>
                        <span>Fast and reliable shipping</span>
                    </div>
                    <div class="benefit-item">
                        <span class="benefit-icon">💬</span>
                        <span>24/7 customer support</span>
                    </div>
                </div>
            </div>
            
            <p style="margin: 24px 0;">Ready to start exploring?</p>
            <a href="{{shopUrl}}" class="cta-button">Start Shopping</a>
            
            <p style="color: #718096; margin-top: 32px;">Questions? We're here to help at <a href="mailto:{{supportEmail}}" style="color: #48bb78;">{{supportEmail}}</a></p>
        </div>
    </div>
</body>
</html>`
  },

  {
    template_key: 'first_purchase_incentive',
    template_name: 'First Purchase Incentive',
    subject_template: "🎯 Ready for Your First Order? Here's 20% OFF!",
    category: 'welcome',
    style: 'bold',
    template_type: 'marketing',
    variables: ['customerName', 'discountCode', 'expiryDate', 'shopUrl', 'companyName', 'minOrderAmount'],
    is_active: true,
    text_template: `🎯 {{customerName}}, Ready for Your First Purchase?

We've got something special for you!

🎁 20% OFF YOUR FIRST ORDER
Code: {{discountCode}}
Minimum order: {{minOrderAmount}}
Expires: {{expiryDate}}

Don't wait - this exclusive offer is just for you!

SHOP NOW: {{shopUrl}}

{{companyName}} - Where Great Deals Meet Quality!`,
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your First Order Discount</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial Black', Arial, sans-serif; line-height: 1.4; background: linear-gradient(45deg, #667eea, #764ba2, #f093fb); color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a, #2d2d2d); }
        .header { background: linear-gradient(135deg, #667eea, #764ba2); padding: 40px 20px; text-align: center; position: relative; overflow: hidden; }
        .header::before { content: '🎯'; position: absolute; top: 20px; left: 20px; font-size: 24px; }
        .header::after { content: '🎁'; position: absolute; top: 20px; right: 20px; font-size: 24px; }
        .content { padding: 40px 24px; }
        .discount-mega { background: linear-gradient(45deg, #ff6b6b, #ee5a52); padding: 32px; border-radius: 16px; text-align: center; margin: 24px 0; border: 4px solid #ffffff; }
        .discount-percent { font-size: 48px; font-weight: 900; margin-bottom: 16px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); }
        .discount-code { background: rgba(255,255,255,0.2); padding: 16px 24px; border-radius: 8px; font-family: monospace; font-size: 24px; font-weight: 900; margin: 20px 0; border: 2px dashed #ffffff; }
        .terms-box { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; margin: 24px 0; }
        .shop-button { display: inline-block; background: linear-gradient(135deg, #2ed573, #1e90ff); color: #ffffff; padding: 20px 40px; border-radius: 50px; text-decoration: none; font-weight: 900; font-size: 20px; text-transform: uppercase; margin: 20px 0; box-shadow: 0 8px 16px rgba(0,0,0,0.3); animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        .urgency-banner { background: #ff4757; color: #ffffff; padding: 16px; text-align: center; font-weight: 900; font-size: 16px; margin: 24px 0; border-radius: 8px; text-transform: uppercase; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="font-size: 32px; font-weight: 900; text-transform: uppercase; margin-bottom: 16px;">FIRST ORDER SPECIAL!</h1>
            <p style="font-size: 18px; opacity: 0.9;">{{companyName}}</p>
        </div>
        
        <div class="content">
            <div style="text-align: center; margin-bottom: 32px;">
                <h2 style="font-size: 28px; font-weight: 900; margin-bottom: 16px;">{{customerName}}, THIS IS FOR YOU!</h2>
                <p style="font-size: 18px; opacity: 0.9;">Ready to make your first purchase? We've got you covered!</p>
            </div>
            
            <div class="discount-mega">
                <div class="discount-percent">20% OFF</div>
                <div style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">YOUR FIRST ORDER</div>
                <div style="margin-bottom: 8px;">Use Code:</div>
                <div class="discount-code">{{discountCode}}</div>
            </div>
            
            <div class="terms-box">
                <div style="font-weight: 700; margin-bottom: 12px; color: #00ff88;">📋 OFFER DETAILS:</div>
                <div>✅ Minimum order: {{minOrderAmount}}</div>
                <div>⏰ Expires: {{expiryDate}}</div>
                <div>🎁 Valid on first purchase only</div>
            </div>
            
            <div class="urgency-banner">
                ⚡ LIMITED TIME - DON'T MISS OUT! ⚡
            </div>
            
            <div style="text-align: center;">
                <a href="{{shopUrl}}" class="shop-button">SHOP NOW & SAVE!</a>
            </div>
            
            <div style="text-align: center; margin-top: 32px;">
                <p style="font-size: 16px; font-weight: 600;">{{companyName}} - Where Great Deals Meet Quality!</p>
            </div>
        </div>
    </div>
</body>
</html>`
  },

  // ===== PROMOTIONAL TEMPLATES =====
  {
    template_key: 'product_launch',
    template_name: 'Product Launch Announcement',
    subject_template: '🚀 Introducing {{productName}} - Now Available!',
    category: 'promotional',
    style: 'modern',
    template_type: 'marketing',
    variables: ['productName', 'launchDate', 'description', 'originalPrice', 'launchPrice', 'shopUrl', 'companyName'],
    is_active: true,
    text_template: `🚀 BIG NEWS!

{{productName}} is finally here!

{{description}}

Launch Special:
- Original Price: {{originalPrice}}
- Launch Price: {{launchPrice}}
- Available: {{launchDate}}

Get yours before everyone else: {{shopUrl}}

The {{companyName}} Team`,
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Product Launch</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #1a202c; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #ed8936, #dd6b20); padding: 40px 24px; text-align: center; color: white; }
        .launch-icon { font-size: 64px; margin-bottom: 16px; }
        .content { padding: 40px 24px; }
        .product-card { background: linear-gradient(135deg, #fef5e7, #fed7aa); border-radius: 12px; padding: 32px 24px; margin: 32px 0; text-align: center; }
        .price-comparison { display: flex; justify-content: center; align-items: center; gap: 16px; margin: 24px 0; }
        .original-price { text-decoration: line-through; color: #a0aec0; font-size: 18px; }
        .launch-price { color: #d69e2e; font-size: 24px; font-weight: 700; }
        .shop-button { display: inline-block; background: linear-gradient(135deg, #ed8936, #dd6b20); color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 24px 0; }
        .launch-badge { background: linear-gradient(135deg, #48bb78, #38a169); color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; display: inline-block; margin-bottom: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="launch-icon">🚀</div>
            <h1 style="font-size: 32px; margin-bottom: 16px;">Product Launch!</h1>
            <p style="opacity: 0.9;">{{companyName}}</p>
        </div>
        
        <div class="content">
            <div style="text-align: center; margin-bottom: 32px;">
                <div class="launch-badge">Now Available</div>
                <h2 style="color: #2d3748; font-size: 28px; margin-bottom: 16px;">{{productName}}</h2>
                <p style="color: #4a5568; font-size: 18px;">Available from {{launchDate}}</p>
            </div>
            
            <div class="product-card">
                <p style="color: #744210; font-size: 16px; margin-bottom: 24px;">{{description}}</p>
                
                <div style="margin-bottom: 16px; color: #744210; font-weight: 600;">Launch Special Pricing:</div>
                <div class="price-comparison">
                    <span class="original-price">{{originalPrice}}</span>
                    <span style="color: #e53e3e; font-size: 20px;">→</span>
                    <span class="launch-price">{{launchPrice}}</span>
                </div>
            </div>
            
            <div style="text-align: center;">
                <p style="margin-bottom: 24px; color: #4a5568;">Be among the first to experience {{productName}}!</p>
                <a href="{{shopUrl}}" class="shop-button">Get Yours Now</a>
            </div>
        </div>
    </div>
</body>
</html>`
  },

  {
    template_key: 'seasonal_sale',
    template_name: 'Seasonal Sale Campaign',
    subject_template: '🌟 {{discountPercentage}}% OFF Everything! Limited Time Only',
    category: 'promotional',
    style: 'bold',
    template_type: 'marketing',
    variables: ['customerName', 'saleDate', 'discountPercentage', 'featuredProducts', 'freeShippingThreshold', 'shopUrl', 'companyName'],
    is_active: true,
    text_template: `🌟 MASSIVE SALE ALERT! 🌟

{{customerName}}, this is HUGE!

{{discountPercentage}}% OFF EVERYTHING!
Sale ends: {{saleDate}}

PLUS: Free shipping on orders over {{freeShippingThreshold}}!

Featured deals:
{{featuredProducts}}

SHOP THE SALE: {{shopUrl}}

Don't wait - these prices won't last!

{{companyName}}`,
    html_template: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Massive Sale Event</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial Black', Arial, sans-serif; line-height: 1.4; background: linear-gradient(45deg, #ff6b6b, #ee5a52, #ff8a80, #ffab91); color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a, #2d2d2d); }
        .header { background: linear-gradient(135deg, #ff6b6b, #ee5a52); padding: 48px 20px; text-align: center; position: relative; overflow: hidden; }
        .header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M20,20 Q50,5 80,20 Q95,50 80,80 Q50,95 20,80 Q5,50 20,20" fill="rgba(255,255,255,0.1)"/></svg>'); animation: float 6s ease-in-out infinite; }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        .sale-icon { font-size: 72px; margin-bottom: 16px; position: relative; z-index: 1; }
        .content { padding: 40px 24px; }
        .mega-discount { background: linear-gradient(45deg, #2ed573, #1e90ff); padding: 32px; border-radius: 20px; text-align: center; margin: 32px 0; border: 4px solid #ffffff; box-shadow: 0 12px 24px rgba(0,0,0,0.3); transform: rotate(-2deg); }
        .discount-text { font-size: 48px; font-weight: 900; margin-bottom: 12px; text-shadow: 3px 3px 6px rgba(0,0,0,0.5); animation: glow 2s ease-in-out infinite alternate; }
        @keyframes glow { from { text-shadow: 3px 3px 6px rgba(0,0,0,0.5), 0 0 20px rgba(255,255,255,0.3); } to { text-shadow: 3px 3px 6px rgba(0,0,0,0.5), 0 0 30px rgba(255,255,255,0.6); } }
        .sale-features { background: rgba(255,255,255,0.1); padding: 24px; border-radius: 12px; margin: 24px 0; }
        .feature-item { display: flex; align-items: center; margin: 12px 0; font-size: 16px; font-weight: 600; }
        .feature-icon { font-size: 20px; margin-right: 12px; }
        .countdown-banner { background: #ff4757; color: #ffffff; padding: 20px; text-align: center; font-weight: 900; font-size: 18px; margin: 24px 0; border-radius: 12px; text-transform: uppercase; border: 2px solid #ffffff; }
        .shop-mega-button { display: inline-block; background: linear-gradient(135deg, #ffa502, #ff6348); color: #000000; padding: 24px 48px; border-radius: 50px; text-decoration: none; font-weight: 900; font-size: 22px; text-transform: uppercase; margin: 24px 0; box-shadow: 0 12px 24px rgba(0,0,0,0.4); animation: bounce 2s infinite; border: 3px solid #ffffff; }
        @keyframes bounce { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-10px); } 60% { transform: translateY(-5px); } }
        .products-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
        .product-item { background: rgba(255,255,255,0.1); padding: 16px; border-radius: 8px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="sale-icon">🌟</div>
            <h1 style="font-size: 36px; font-weight: 900; text-transform: uppercase; margin-bottom: 16px; position: relative; z-index: 1;">MASSIVE SALE EVENT!</h1>
            <p style="font-size: 18px; opacity: 0.9; position: relative; z-index: 1;">{{companyName}}</p>
        </div>
        
        <div class="content">
            <div style="text-align: center; margin-bottom: 32px;">
                <h2 style="font-size: 28px; font-weight: 900; margin-bottom: 16px;">{{customerName}}, THIS IS HUGE!</h2>
            </div>
            
            <div class="mega-discount">
                <div class="discount-text">{{discountPercentage}}% OFF</div>
                <div style="font-size: 20px; font-weight: 700;">EVERYTHING IN STORE!</div>
            </div>
            
            <div class="sale-features">
                <div style="font-weight: 700; margin-bottom: 16px; font-size: 18px; color: #00ff88;">🎁 SALE FEATURES:</div>
                <div class="feature-item">
                    <span class="feature-icon">💥</span>
                    <span>{{discountPercentage}}% off ALL products</span>
                </div>
                <div class="feature-item">
                    <span class="feature-icon">🚚</span>
                    <span>FREE shipping over {{freeShippingThreshold}}</span>
                </div>
                <div class="feature-item">
                    <span class="feature-icon">⭐</span>
                    <span>Featured products included</span>
                </div>
                <div class="feature-item">
                    <span class="feature-icon">⚡</span>
                    <span>Limited time only!</span>
                </div>
            </div>
            
            <div style="margin: 24px 0;">
                <h3 style="color: #00ff88; margin-bottom: 16px; font-size: 18px;">🔥 FEATURED DEALS:</h3>
                <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px;">
                    {{featuredProducts}}
                </div>
            </div>
            
            <div class="countdown-banner">
                ⏰ SALE ENDS {{saleDate}} - DON'T MISS OUT! ⏰
            </div>
            
            <div style="text-align: center;">
                <a href="{{shopUrl}}" class="shop-mega-button">SHOP THE SALE NOW!</a>
            </div>
            
            <div style="text-align: center; margin-top: 24px;">
                <p style="font-size: 16px; font-weight: 600; opacity: 0.9;">These prices won't last - grab your favorites before they're gone!</p>
            </div>
        </div>
    </div>
</body>
</html>`
  }
];