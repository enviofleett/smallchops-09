-- Create missing critical email templates for production
-- This migration adds essential email templates that are referenced in the codebase

INSERT INTO enhanced_email_templates (template_key, template_name, subject_template, html_template, text_template, template_type, variables, is_active) VALUES

-- Password reset template
('password_reset', 'Password Reset', 
 'Reset Your Password - {{companyName}}', 
 '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: {{primaryColor}};">Reset Your Password</h1>
  <p>Hello {{customerName}},</p>
  <p>We received a request to reset your password for your {{companyName}} account.</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{resetLink}}" style="background-color: {{primaryColor}}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
      Reset Password
    </a>
  </div>
  <p><strong>This link will expire in {{expiryTime}}.</strong></p>
  <p>If you did not request this password reset, please ignore this email.</p>
  <p>For security, never share this link with anyone.</p>
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
  <p style="color: #666; font-size: 12px;">
    If the button above does not work, copy and paste this link into your browser:<br>
    {{resetLink}}
  </p>
  <p style="color: #666; font-size: 12px;">
    Best regards,<br>
    The {{companyName}} Team<br>
    {{supportEmail}}
  </p>
</div>',
 'Reset Your Password - {{companyName}}

Hello {{customerName}},

We received a request to reset your password for your {{companyName}} account.

Click this link to reset your password:
{{resetLink}}

This link will expire in {{expiryTime}}.

If you did not request this password reset, please ignore this email.

Best regards,
The {{companyName}} Team
{{supportEmail}}',
 'transactional', 
 ARRAY['customerName', 'companyName', 'resetLink', 'expiryTime', 'primaryColor', 'supportEmail'], 
 true),

-- Order shipped template
('order_shipped', 'Order Shipped', 
 'Your Order {{orderNumber}} Has Shipped! - {{companyName}}',
 '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: {{primaryColor}};">Your Order Has Shipped! 📦</h1>
  <p>Hello {{customerName}},</p>
  <p>Great news! Your order <strong>{{orderNumber}}</strong> has been shipped and is on its way to you.</p>
  
  <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
    <h3>Shipping Details:</h3>
    <p><strong>Order Number:</strong> {{orderNumber}}</p>
    <p><strong>Tracking Number:</strong> {{trackingNumber}}</p>
    <p><strong>Estimated Delivery:</strong> {{estimatedDelivery}}</p>
    <p><strong>Shipping Address:</strong><br>{{shippingAddress}}</p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="{{trackingUrl}}" style="background-color: {{primaryColor}}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
      Track Your Order
    </a>
  </div>

  <p>You will receive another email confirmation once your order has been delivered.</p>
  
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
  <p style="color: #666; font-size: 12px;">
    Questions about your order? Contact us at {{supportEmail}}
  </p>
  <p style="color: #666; font-size: 12px;">
    Thank you for choosing {{companyName}}!
  </p>
</div>',
 'Your Order {{orderNumber}} Has Shipped!

Hello {{customerName}},

Your order {{orderNumber}} has been shipped and is on its way to you.

Tracking Number: {{trackingNumber}}
Estimated Delivery: {{estimatedDelivery}}

Track your order: {{trackingUrl}}

Thank you for choosing {{companyName}}!
{{supportEmail}}',
 'transactional',
 ARRAY['customerName', 'orderNumber', 'trackingNumber', 'estimatedDelivery', 'shippingAddress', 'trackingUrl', 'companyName', 'primaryColor', 'supportEmail'],
 true),

-- Order delivered template
('order_delivered', 'Order Delivered', 
 'Your Order {{orderNumber}} Has Been Delivered! - {{companyName}}',
 '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: {{primaryColor}};">Order Delivered Successfully! ✅</h1>
  <p>Hello {{customerName}},</p>
  <p>Your order <strong>{{orderNumber}}</strong> has been delivered to your address.</p>
  
  <div style="background: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #4CAF50;">
    <h3 style="color: #2E7D32; margin-top: 0;">Delivery Confirmed</h3>
    <p><strong>Delivered on:</strong> {{deliveryDate}}</p>
    <p><strong>Delivered to:</strong> {{deliveryAddress}}</p>
  </div>

  <p>We hope you enjoy your purchase! If you have any questions or concerns about your order, please don''t hesitate to contact us.</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="{{reviewUrl}}" style="background-color: {{primaryColor}}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
      Leave a Review
    </a>
  </div>

  <p style="text-align: center; color: #666;">
    Your feedback helps us improve our service for everyone.
  </p>
  
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
  <p style="color: #666; font-size: 12px;">
    Thank you for choosing {{companyName}}!<br>
    Need help? Contact us at {{supportEmail}}
  </p>
</div>',
 'Your Order {{orderNumber}} Has Been Delivered!

Hello {{customerName}},

Your order {{orderNumber}} has been successfully delivered.

Delivered on: {{deliveryDate}}
Delivered to: {{deliveryAddress}}

Leave a review: {{reviewUrl}}

Thank you for choosing {{companyName}}!
{{supportEmail}}',
 'transactional',
 ARRAY['customerName', 'orderNumber', 'deliveryDate', 'deliveryAddress', 'reviewUrl', 'companyName', 'primaryColor', 'supportEmail'],
 true),

-- Cart abandonment template
('cart_abandonment', 'Don\'t Forget Your Cart', 
 'You Left Something Delicious Behind! - {{companyName}}',
 '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: {{primaryColor}};">Don''t Forget Your Cart! 🛒</h1>
  <p>Hello {{customerName}},</p>
  <p>We noticed you left some delicious items in your cart. Don''t let them get away!</p>
  
  <div style="background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px;">
    <h3>Items in Your Cart:</h3>
    <p><strong>{{itemsCount}} items</strong> waiting for you</p>
    <p><strong>Total Value:</strong> {{cartTotal}}</p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="{{cartRecoveryLink}}" style="background-color: {{primaryColor}}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px;">
      Complete Your Order
    </a>
  </div>

  <p style="text-align: center; color: #666;">
    Complete your order within 24 hours to secure these items!
  </p>

  <div style="background: #fffbf0; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #FFA726;">
    <p style="margin: 0; color: #F57C00;">
      💡 <strong>Pro Tip:</strong> These popular items tend to sell out quickly!
    </p>
  </div>
  
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
  <p style="color: #666; font-size: 12px;">
    This is a friendly reminder about your cart. You can unsubscribe from these emails at any time.<br>
    {{companyName}} - {{supportEmail}}
  </p>
</div>',
 'Don''t Forget Your Cart!

Hello {{customerName}},

You left {{itemsCount}} items in your cart worth {{cartTotal}}.

Complete your order: {{cartRecoveryLink}}

Don''t miss out on these delicious items!

{{companyName}}
{{supportEmail}}',
 'marketing',
 ARRAY['customerName', 'itemsCount', 'cartTotal', 'cartRecoveryLink', 'companyName', 'primaryColor', 'supportEmail'],
 true),

-- Admin new order notification
('admin_new_order', 'New Order Received', 
 'New Order #{{orderNumber}} - ₦{{orderTotal}}',
 '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #2563eb;">New Order Received! 🎉</h1>
  
  <div style="background: #f0f9ff; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #2563eb;">
    <h3 style="margin-top: 0;">Order Details</h3>
    <p><strong>Order Number:</strong> {{orderNumber}}</p>
    <p><strong>Customer:</strong> {{customerName}}</p>
    <p><strong>Total Amount:</strong> ₦{{orderTotal}}</p>
    <p><strong>Items:</strong> {{itemsCount}} items</p>
    <p><strong>Order Date:</strong> {{orderDate}}</p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="{{adminOrderUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
      View Order Details
    </a>
  </div>

  <div style="background: #fef3c7; padding: 15px; margin: 20px 0; border-radius: 5px;">
    <p style="margin: 0; color: #92400e;">
      ⏰ <strong>Action Required:</strong> Please process this order within 2 hours for same-day delivery.
    </p>
  </div>
  
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
  <p style="color: #666; font-size: 12px;">
    This is an automated notification from your order management system.
  </p>
</div>',
 'New Order Received!

Order Number: {{orderNumber}}
Customer: {{customerName}}
Total: ₦{{orderTotal}}
Items: {{itemsCount}}
Date: {{orderDate}}

View order: {{adminOrderUrl}}

Please process within 2 hours for same-day delivery.',
 'transactional',
 ARRAY['orderNumber', 'customerName', 'orderTotal', 'itemsCount', 'orderDate', 'adminOrderUrl'],
 true),

-- Payment receipt template
('payment_receipt', 'Payment Confirmation', 
 'Payment Received - {{paymentReference}} - {{companyName}}',
 '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: {{primaryColor}};">Payment Confirmed! ✅</h1>
  <p>Hello {{customerName}},</p>
  <p>We have successfully received your payment. Here are the details:</p>
  
  <div style="background: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #4CAF50;">
    <h3 style="color: #2E7D32; margin-top: 0;">Payment Details</h3>
    <p><strong>Reference:</strong> {{paymentReference}}</p>
    <p><strong>Amount Paid:</strong> ₦{{amountPaid}}</p>
    <p><strong>Payment Method:</strong> {{paymentMethod}}</p>
    <p><strong>Transaction Date:</strong> {{transactionDate}}</p>
    <p><strong>Status:</strong> <span style="color: #4CAF50; font-weight: bold;">Confirmed</span></p>
  </div>

  {{#if orderNumber}}
  <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
    <h4>Related Order</h4>
    <p><strong>Order Number:</strong> {{orderNumber}}</p>
    <p>Your order is now being processed and will be prepared for delivery.</p>
  </div>
  {{/if}}

  <p>Keep this email as your receipt for accounting purposes.</p>
  
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
  <p style="color: #666; font-size: 12px;">
    Questions about this payment? Contact us at {{supportEmail}}<br>
    Thank you for choosing {{companyName}}!
  </p>
</div>',
 'Payment Confirmed!

Hello {{customerName}},

Payment Reference: {{paymentReference}}
Amount: ₦{{amountPaid}}
Method: {{paymentMethod}}
Date: {{transactionDate}}
Status: Confirmed

{{#if orderNumber}}
Order Number: {{orderNumber}}
{{/if}}

Thank you for choosing {{companyName}}!
{{supportEmail}}',
 'transactional',
 ARRAY['customerName', 'paymentReference', 'amountPaid', 'paymentMethod', 'transactionDate', 'orderNumber', 'companyName', 'primaryColor', 'supportEmail'],
 true)

ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP;