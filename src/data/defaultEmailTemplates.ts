// Default email templates with diverse visual styles
export const defaultEmailTemplates = [
  // Order Confirmation Templates (4 styles)
  {
    template_key: 'order_confirmation_clean',
    template_name: 'Order Confirmation - Clean',
    subject_template: 'Order Confirmed #{{orderNumber}} - {{businessName}}',
    html_template: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #3b82f6; color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 30px 20px; }
    .order-details { background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 14px; color: #64748b; }
    @media only screen and (max-width: 600px) { .container { width: 100% !important; } .header, .content { padding: 20px 15px !important; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 28px;">{{businessName}}</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Order Confirmation</p>
    </div>
    <div class="content">
      <h2 style="color: #1e293b; margin-bottom: 10px;">Thank you, {{customerName}}!</h2>
      <p>Your order has been confirmed and is being prepared for {{orderType}}.</p>
      
      <div class="order-details">
        <h3 style="margin-top: 0; color: #1e293b;">Order Details</h3>
        <p><strong>Order Number:</strong> {{orderNumber}}</p>
        <p><strong>Order Date:</strong> {{orderDate}}</p>
        <p><strong>Total Amount:</strong> ${{orderTotal}}</p>
      </div>
      
      <a href="{{trackingUrl}}" class="button">Track Your Order</a>
      
      <p>We'll send you updates as your order progresses. If you have any questions, please contact our support team.</p>
    </div>
    <div class="footer">
      <p>{{businessName}} | {{businessAddress}}</p>
      <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> | <a href="{{contactUrl}}">Contact Us</a></p>
    </div>
  </div>
</body>
</html>`,
    text_template: `Order Confirmed #{{orderNumber}} - {{businessName}}

Thank you, {{customerName}}!

Your order has been confirmed and is being prepared for {{orderType}}.

Order Details:
Order Number: {{orderNumber}}
Order Date: {{orderDate}}
Total Amount: ${{orderTotal}}

We'll send you updates as your order progresses.

Best regards,
{{businessName}}`,
    template_type: 'transactional',
    variables: ['customerName', 'orderNumber', 'orderDate', 'orderTotal', 'orderType', 'businessName', 'businessAddress', 'trackingUrl', 'unsubscribeUrl', 'contactUrl'],
    is_active: true
  },

  {
    template_key: 'order_confirmation_modern',
    template_name: 'Order Confirmation - Modern',
    subject_template: '✅ Order {{orderNumber}} Confirmed - {{businessName}}',
    html_template: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
    .content { padding: 40px 30px; }
    .status-badge { display: inline-block; background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-bottom: 20px; }
    .order-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; }
    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }
    .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; border-top: 1px solid #e5e7eb; }
    @media only screen and (max-width: 600px) { .container { margin: 20px; } .header, .content { padding: 30px 20px !important; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 32px; font-weight: 700;">{{businessName}}</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 18px;">Order Confirmed! 🎉</p>
    </div>
    <div class="content">
      <div class="status-badge">✅ Confirmed</div>
      <h2 style="color: #1f2937; margin-bottom: 10px; font-size: 24px;">Hi {{customerName}},</h2>
      <p style="font-size: 16px; color: #4b5563;">Great news! Your order is confirmed and we're getting it ready for {{orderType}}.</p>
      
      <div class="order-card">
        <h3 style="margin-top: 0; color: #1f2937; font-size: 20px;">📦 Order Summary</h3>
        <p><strong>Order #:</strong> {{orderNumber}}</p>
        <p><strong>Date:</strong> {{orderDate}}</p>
        <p><strong>Total:</strong> ${{orderTotal}}</p>
      </div>
      
      <a href="{{trackingUrl}}" class="button">🚚 Track Your Order</a>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">You'll receive updates via email as your order progresses. Questions? We're here to help!</p>
    </div>
    <div class="footer">
      <p style="margin: 0 0 10px 0; font-weight: 600;">{{businessName}}</p>
      <p style="margin: 0 0 15px 0; font-size: 14px;">{{businessAddress}}</p>
      <p style="margin: 0; font-size: 12px;"><a href="{{unsubscribeUrl}}" style="color: #6b7280;">Unsubscribe</a> • <a href="{{contactUrl}}" style="color: #6b7280;">Contact Support</a></p>
    </div>
  </div>
</body>
</html>`,
    text_template: `✅ Order {{orderNumber}} Confirmed - {{businessName}}

Hi {{customerName}},

Great news! Your order is confirmed and we're getting it ready for {{orderType}}.

Order Summary:
Order #: {{orderNumber}}
Date: {{orderDate}}
Total: ${{orderTotal}}

You'll receive updates via email as your order progresses.

Best regards,
{{businessName}}`,
    template_type: 'transactional',
    variables: ['customerName', 'orderNumber', 'orderDate', 'orderTotal', 'orderType', 'businessName', 'businessAddress', 'trackingUrl', 'unsubscribeUrl', 'contactUrl'],
    is_active: true
  },

  {
    template_key: 'order_confirmation_bold',
    template_name: 'Order Confirmation - Bold',
    subject_template: '🚀 Order {{orderNumber}} is ON THE WAY! - {{businessName}}',
    html_template: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
  <style>
    body { font-family: 'Roboto', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background: #000; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(45deg, #ff6b6b, #ee5a24); color: white; padding: 40px 20px; text-align: center; }
    .content { padding: 40px 20px; }
    .highlight-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 15px; text-align: center; margin: 30px 0; }
    .button { display: inline-block; background: linear-gradient(45deg, #ff6b6b, #ee5a24); color: white; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; margin: 20px 0; }
    .footer { background: #1a1a1a; color: white; padding: 30px; text-align: center; }
    @media only screen and (max-width: 600px) { .container { width: 100% !important; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 36px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">{{businessName}}</h1>
      <p style="margin: 15px 0 0 0; font-size: 20px; font-weight: 600;">ORDER LOCKED & LOADED! 🔥</p>
    </div>
    <div class="content">
      <h2 style="color: #1a1a1a; margin-bottom: 10px; font-size: 28px; font-weight: 800;">{{customerName}}, YOU'RE IN!</h2>
      <p style="font-size: 18px; font-weight: 600;">Your order is confirmed and we're moving FAST to get it to you!</p>
      
      <div class="highlight-box">
        <h3 style="margin-top: 0; font-size: 24px; font-weight: 700;">🎯 ORDER DETAILS</h3>
        <p><strong>Order #:</strong> {{orderNumber}}</p>
        <p><strong>Total:</strong> ${{orderTotal}}</p>
        <p><strong>Method:</strong> {{orderType}}</p>
      </div>
      
      <div style="text-align: center;">
        <a href="{{trackingUrl}}" class="button">🚀 TRACK NOW</a>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 30px 0; border-left: 5px solid #ff6b6b;">
        <h4 style="margin-top: 0; color: #1a1a1a;">⚡ WHAT'S NEXT?</h4>
        <p style="margin-bottom: 0;">We're preparing your order right now! You'll get real-time updates every step of the way.</p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 10px 0; font-weight: 700; font-size: 18px;">{{businessName}}</p>
      <p style="margin: 0 0 15px 0;">{{businessAddress}}</p>
      <p style="margin: 0; font-size: 12px; opacity: 0.8;"><a href="{{unsubscribeUrl}}" style="color: #ccc;">Unsubscribe</a> | <a href="{{contactUrl}}" style="color: #ccc;">Support</a></p>
    </div>
  </div>
</body>
</html>`,
    text_template: `🚀 Order {{orderNumber}} is ON THE WAY! - {{businessName}}

{{customerName}}, YOU'RE IN!

Your order is confirmed and we're moving FAST to get it to you!

ORDER DETAILS:
Order #: {{orderNumber}}
Total: ${{orderTotal}}
Method: {{orderType}}

We're preparing your order right now! You'll get real-time updates every step of the way.

{{businessName}}
{{businessAddress}}`,
    template_type: 'transactional',
    variables: ['customerName', 'orderNumber', 'orderDate', 'orderTotal', 'orderType', 'businessName', 'businessAddress', 'trackingUrl', 'unsubscribeUrl', 'contactUrl'],
    is_active: true
  },

  {
    template_key: 'order_confirmation_elegant',
    template_name: 'Order Confirmation - Elegant',
    subject_template: 'Your Order Confirmation - {{businessName}}',
    html_template: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
  <style>
    body { font-family: 'Georgia', 'Times New Roman', serif; line-height: 1.8; color: #2c2c2c; margin: 0; padding: 0; background: #f5f5f0; }
    .container { max-width: 600px; margin: 40px auto; background: white; box-shadow: 0 0 30px rgba(0,0,0,0.1); }
    .header { background: #2c3e50; color: #ecf0f1; padding: 50px 30px; text-align: center; }
    .ornament { border-top: 3px solid #c9b037; border-bottom: 3px solid #c9b037; padding: 20px 0; margin: 20px 0; text-align: center; }
    .content { padding: 50px 40px; }
    .elegant-box { border: 2px solid #c9b037; padding: 30px; margin: 30px 0; position: relative; }
    .button { display: inline-block; background: #2c3e50; color: white; padding: 15px 30px; text-decoration: none; border: 2px solid #2c3e50; margin: 30px 0; }
    .signature { font-style: italic; color: #7f8c8d; border-top: 1px solid #bdc3c7; padding-top: 20px; margin-top: 30px; }
    .footer { background: #34495e; color: #ecf0f1; padding: 30px; text-align: center; font-size: 14px; }
    @media only screen and (max-width: 600px) { .container { margin: 20px; } .content { padding: 30px 20px !important; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 32px; font-weight: normal; letter-spacing: 3px;">{{businessName}}</h1>
      <div class="ornament">
        <p style="margin: 0; font-size: 16px; font-style: italic;">Order Confirmation</p>
      </div>
    </div>
    <div class="content">
      <h2 style="color: #2c3e50; margin-bottom: 20px; font-size: 24px; font-weight: normal;">Dear {{customerName}},</h2>
      <p style="font-size: 16px;">We are delighted to confirm that your order has been received and is currently being prepared with the utmost care for {{orderType}}.</p>
      
      <div class="elegant-box">
        <h3 style="margin-top: 0; color: #c9b037; text-align: center;">Order Details</h3>
        <p><strong>Order Number:</strong> {{orderNumber}}</p>
        <p><strong>Order Date:</strong> {{orderDate}}</p>
        <p><strong>Total Amount:</strong> <span style="color: #c9b037; font-weight: bold;">${{orderTotal}}</span></p>
      </div>
      
      <div style="text-align: center;">
        <a href="{{trackingUrl}}" class="button">View Order Status</a>
      </div>
      
      <p style="font-size: 16px;">We will keep you informed of your order's progress and notify you promptly upon completion.</p>
      
      <div class="signature">
        <p>With sincere gratitude,<br>
        <strong>The {{businessName}} Team</strong></p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 10px 0;">{{businessName}}</p>
      <p style="margin: 0 0 15px 0;">{{businessAddress}}</p>
      <p style="margin: 0; opacity: 0.8;"><a href="{{unsubscribeUrl}}" style="color: #bdc3c7;">Unsubscribe</a> • <a href="{{contactUrl}}" style="color: #bdc3c7;">Contact Us</a></p>
    </div>
  </div>
</body>
</html>`,
    text_template: `Your Order Confirmation - {{businessName}}

Dear {{customerName}},

We are delighted to confirm that your order has been received and is currently being prepared with the utmost care for {{orderType}}.

Order Details:
Order Number: {{orderNumber}}
Order Date: {{orderDate}}
Total Amount: ${{orderTotal}}

We will keep you informed of your order's progress and notify you promptly upon completion.

With sincere gratitude,
The {{businessName}} Team

{{businessAddress}}`,
    template_type: 'transactional',
    variables: ['customerName', 'orderNumber', 'orderDate', 'orderTotal', 'orderType', 'businessName', 'businessAddress', 'trackingUrl', 'unsubscribeUrl', 'contactUrl'],
    is_active: true
  },

  // Shipping Update Templates (3 styles)
  {
    template_key: 'shipping_update_clean',
    template_name: 'Shipping Update - Clean',
    subject_template: 'Your Order {{orderNumber}} is {{newStatus}} - {{businessName}}',
    html_template: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shipping Update</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #059669; color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 30px 20px; }
    .status-timeline { margin: 30px 0; }
    .status-item { display: flex; align-items: center; margin: 15px 0; padding: 15px; border-radius: 8px; background: #f9fafb; }
    .status-item.active { background: #d1fae5; border-left: 4px solid #059669; }
    .status-icon { width: 30px; height: 30px; border-radius: 50%; margin-right: 15px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; background: #9ca3af; }
    .status-icon.active { background: #059669; }
    .button { display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 14px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 28px;">{{businessName}}</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Order Update</p>
    </div>
    <div class="content">
      <h2 style="color: #1e293b; margin-bottom: 10px;">Hi {{customerName}},</h2>
      <p>Great news! Your order #{{orderNumber}} status has been updated to <strong>{{newStatus}}</strong>.</p>
      
      <div class="status-timeline">
        <div class="status-item active">
          <div class="status-icon active">✓</div>
          <div>
            <h4 style="margin: 0; color: #1e293b;">Order Confirmed</h4>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">Your order has been received</p>
          </div>
        </div>
        <div class="status-item">
          <div class="status-icon">📦</div>
          <div>
            <h4 style="margin: 0; color: #1e293b;">Preparing</h4>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">We're getting your order ready</p>
          </div>
        </div>
        <div class="status-item">
          <div class="status-icon">🚚</div>
          <div>
            <h4 style="margin: 0; color: #1e293b;">Out for Delivery</h4>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">{{estimatedTime}}</p>
          </div>
        </div>
      </div>
      
      <a href="{{trackingUrl}}" class="button">Track Your Order</a>
      
      <p>We'll continue to update you as your order progresses.</p>
    </div>
    <div class="footer">
      <p>{{businessName}} | {{businessAddress}}</p>
      <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> | <a href="{{contactUrl}}">Contact Us</a></p>
    </div>
  </div>
</body>
</html>`,
    text_template: `Your Order {{orderNumber}} is {{newStatus}} - {{businessName}}

Hi {{customerName}},

Great news! Your order #{{orderNumber}} status has been updated to {{newStatus}}.

Estimated time: {{estimatedTime}}

We'll continue to update you as your order progresses.

Best regards,
{{businessName}}`,
    template_type: 'transactional',
    variables: ['customerName', 'orderNumber', 'newStatus', 'oldStatus', 'estimatedTime', 'orderType', 'businessName', 'businessAddress', 'trackingUrl', 'unsubscribeUrl', 'contactUrl'],
    is_active: true
  },

  // Welcome Email Templates (3 styles)
  {
    template_key: 'welcome_clean',
    template_name: 'Welcome Email - Clean',
    subject_template: 'Welcome to {{businessName}}, {{customerName}}!',
    html_template: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #3b82f6; color: white; padding: 40px 20px; text-align: center; }
    .content { padding: 40px 20px; }
    .welcome-box { background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 30px; margin: 30px 0; text-align: center; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 14px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 32px;">Welcome to {{businessName}}!</h1>
      <p style="margin: 15px 0 0 0; opacity: 0.9; font-size: 18px;">We're excited to have you with us</p>
    </div>
    <div class="content">
      <h2 style="color: #1e293b; margin-bottom: 20px;">Hi {{customerName}},</h2>
      <p style="font-size: 16px;">Thank you for joining {{businessName}}! We're thrilled to welcome you to our community.</p>
      
      <div class="welcome-box">
        <h3 style="margin-top: 0; color: #0369a1;">🎉 You're All Set!</h3>
        <p style="margin-bottom: 0;">Your account has been created successfully. You can now explore our products and start shopping!</p>
      </div>
      
      <p>Here's what you can do next:</p>
      <ul style="padding-left: 20px;">
        <li>Browse our latest products</li>
        <li>Set up your preferences</li>
        <li>Follow your favorite items</li>
        <li>Enjoy exclusive member benefits</li>
      </ul>
      
      <div style="text-align: center;">
        <a href="{{shopUrl}}" class="button">Start Shopping</a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">If you have any questions, our support team is here to help!</p>
    </div>
    <div class="footer">
      <p>{{businessName}} | {{businessAddress}}</p>
      <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> | <a href="{{contactUrl}}">Contact Us</a></p>
    </div>
  </div>
</body>
</html>`,
    text_template: `Welcome to {{businessName}}!

Hi {{customerName}},

Thank you for joining {{businessName}}! We're thrilled to welcome you to our community.

Your account has been created successfully. You can now explore our products and start shopping!

Here's what you can do next:
• Browse our latest products
• Set up your preferences
• Follow your favorite items
• Enjoy exclusive member benefits

If you have any questions, our support team is here to help!

Best regards,
{{businessName}}`,
    template_type: 'transactional',
    variables: ['customerName', 'businessName', 'businessAddress', 'shopUrl', 'unsubscribeUrl', 'contactUrl'],
    is_active: true
  },

  // Abandoned Cart Templates (2 styles)
  {
    template_key: 'abandoned_cart_friendly',
    template_name: 'Abandoned Cart - Friendly',
    subject_template: 'Don\'t forget your items at {{businessName}}!',
    html_template: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Items Waiting</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #f59e0b; color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 30px 20px; }
    .cart-items { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .button { display: inline-block; background: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 14px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 28px;">🛒 Items Waiting for You!</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">at {{businessName}}</p>
    </div>
    <div class="content">
      <h2 style="color: #1e293b; margin-bottom: 10px;">Hi {{customerName}},</h2>
      <p>We noticed you left some great items in your cart. Don't let them get away!</p>
      
      <div class="cart-items">
        <h3 style="margin-top: 0; color: #92400e;">📋 Your Cart Items</h3>
        <p>{{cartItems}}</p>
        <p><strong>Total: ${{cartTotal}}</strong></p>
      </div>
      
      <p>These popular items are selling fast. Complete your order now to secure them!</p>
      
      <div style="text-align: center;">
        <a href="{{checkoutUrl}}" class="button">Complete Your Order</a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">Need help? Our customer service team is standing by to assist you.</p>
    </div>
    <div class="footer">
      <p>{{businessName}} | {{businessAddress}}</p>
      <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> | <a href="{{contactUrl}}">Contact Us</a></p>
    </div>
  </div>
</body>
</html>`,
    text_template: `Don't forget your items at {{businessName}}!

Hi {{customerName}},

We noticed you left some great items in your cart. Don't let them get away!

Your Cart Items:
{{cartItems}}
Total: ${{cartTotal}}

These popular items are selling fast. Complete your order now to secure them!

Need help? Our customer service team is standing by to assist you.

Best regards,
{{businessName}}`,
    template_type: 'marketing',
    variables: ['customerName', 'businessName', 'businessAddress', 'cartItems', 'cartTotal', 'checkoutUrl', 'unsubscribeUrl', 'contactUrl'],
    is_active: true
  },

  // Promotional Templates (3 styles)
  {
    template_key: 'promotion_bold',
    template_name: 'Promotion - Bold Sale',
    subject_template: '🔥 HUGE SALE: {{discountPercent}}% OFF Everything!',
    html_template: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Big Sale</title>
  <style>
    body { font-family: 'Arial Black', Arial, sans-serif; line-height: 1.6; color: #fff; margin: 0; padding: 0; background: linear-gradient(45deg, #ff6b6b, #ee5a24); }
    .container { max-width: 600px; margin: 0 auto; background: #000; }
    .header { background: linear-gradient(45deg, #ff6b6b, #ee5a24); color: white; padding: 50px 20px; text-align: center; }
    .content { padding: 40px 20px; background: #000; color: #fff; }
    .sale-banner { background: linear-gradient(45deg, #ffd700, #ffed4e); color: #000; padding: 30px; border-radius: 15px; text-align: center; margin: 30px 0; border: 3px solid #ffd700; }
    .button { display: inline-block; background: linear-gradient(45deg, #ff6b6b, #ee5a24); color: white; padding: 20px 40px; text-decoration: none; border-radius: 50px; font-weight: 900; font-size: 18px; text-transform: uppercase; letter-spacing: 2px; margin: 30px 0; box-shadow: 0 10px 20px rgba(255, 107, 107, 0.3); }
    .footer { background: #1a1a1a; color: #ccc; padding: 30px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 48px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">MEGA SALE!</h1>
      <p style="margin: 20px 0 0 0; font-size: 24px; font-weight: 700;">{{businessName}} Exclusive</p>
    </div>
    <div class="content">
      <div class="sale-banner">
        <h2 style="margin: 0; font-size: 36px; font-weight: 900; color: #000;">🔥 {{discountPercent}}% OFF</h2>
        <p style="margin: 10px 0 0 0; font-size: 20px; font-weight: 700; color: #000;">EVERYTHING MUST GO!</p>
      </div>
      
      <h3 style="color: #ffd700; font-size: 24px; text-align: center; margin: 30px 0;">LIMITED TIME ONLY!</h3>
      
      <p style="font-size: 18px; text-align: center;">Don't miss out on the BIGGEST sale of the year! Save massive on all your favorite items.</p>
      
      <div style="text-align: center;">
        <a href="{{shopUrl}}" class="button">🛒 SHOP NOW</a>
      </div>
      
      <div style="background: #333; padding: 20px; border-radius: 10px; margin: 30px 0; text-align: center;">
        <p style="margin: 0; font-size: 16px; color: #ffd700;">⏰ HURRY! Sale ends {{saleEndDate}}</p>
        <p style="margin: 10px 0 0 0; font-size: 14px;">Use code: <strong style="color: #ff6b6b;">{{promoCode}}</strong></p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 10px 0; font-weight: 700;">{{businessName}}</p>
      <p style="margin: 0 0 15px 0;">{{businessAddress}}</p>
      <p style="margin: 0; font-size: 12px;"><a href="{{unsubscribeUrl}}" style="color: #999;">Unsubscribe</a> | <a href="{{contactUrl}}" style="color: #999;">Contact</a></p>
    </div>
  </div>
</body>
</html>`,
    text_template: `🔥 HUGE SALE: {{discountPercent}}% OFF Everything!

MEGA SALE at {{businessName}}!

{{discountPercent}}% OFF EVERYTHING MUST GO!

LIMITED TIME ONLY!

Don't miss out on the BIGGEST sale of the year! Save massive on all your favorite items.

HURRY! Sale ends {{saleEndDate}}
Use code: {{promoCode}}

{{businessName}}
{{businessAddress}}`,
    template_type: 'marketing',
    variables: ['businessName', 'businessAddress', 'discountPercent', 'saleEndDate', 'promoCode', 'shopUrl', 'unsubscribeUrl', 'contactUrl'],
    is_active: true
  }
];