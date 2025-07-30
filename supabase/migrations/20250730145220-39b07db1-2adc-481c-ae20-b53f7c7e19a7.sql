-- Insert default email templates for common use cases
INSERT INTO public.enhanced_email_templates (
  template_key,
  template_name,
  subject_template,
  html_template,
  text_template,
  variables,
  template_type,
  is_active
) VALUES
(
  'order_confirmed',
  'Order Confirmation',
  'Order Confirmed #{{orderNumber}}',
  '
  <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Order Confirmed!</h1>
        <p>Hi {{customerName}},</p>
        <p>Thank you for your order! We have received your order and are preparing it for delivery.</p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3>Order Details:</h3>
          <p><strong>Order Number:</strong> {{orderNumber}}</p>
          <p><strong>Order Date:</strong> {{orderDate}}</p>
          <p><strong>Total Amount:</strong> ₦{{orderTotal}}</p>
          {{#if deliveryAddress}}<p><strong>Delivery Address:</strong> {{deliveryAddress}}</p>{{/if}}
          {{#if pickupAddress}}<p><strong>Pickup Address:</strong> {{pickupAddress}}</p>{{/if}}
        </div>
        
        <p>We will notify you when your order is ready for pickup or out for delivery.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 14px; color: #6b7280;">
            Best regards,<br>
            {{companyName}}<br>
            <a href="{{siteUrl}}" style="color: #2563eb;">{{siteUrl}}</a>
          </p>
          <p style="font-size: 12px; color: #9ca3af;">
            <a href="{{unsubscribeUrl}}" style="color: #9ca3af;">Unsubscribe</a> from these emails.
          </p>
        </div>
      </div>
    </body>
  </html>
  ',
  'Order Confirmed #{{orderNumber}}

Hi {{customerName}},

Thank you for your order! We have received your order and are preparing it for delivery.

Order Details:
- Order Number: {{orderNumber}}
- Order Date: {{orderDate}}
- Total Amount: ₦{{orderTotal}}
{{#if deliveryAddress}}- Delivery Address: {{deliveryAddress}}{{/if}}
{{#if pickupAddress}}- Pickup Address: {{pickupAddress}}{{/if}}

We will notify you when your order is ready for pickup or out for delivery.

Best regards,
{{companyName}}
{{siteUrl}}

Unsubscribe: {{unsubscribeUrl}}',
  ARRAY['customerName', 'orderNumber', 'orderDate', 'orderTotal', 'deliveryAddress', 'pickupAddress', 'companyName', 'siteUrl', 'unsubscribeUrl'],
  'order',
  true
),
(
  'order_processing',
  'Order Being Prepared',
  'Your Order #{{orderNumber}} is Being Prepared',
  '
  <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #059669;">Your Order is Being Prepared!</h1>
        <p>Hi {{customerName}},</p>
        <p>Great news! Your order #{{orderNumber}} is now being prepared by our team.</p>
        
        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
          <p><strong>Status:</strong> {{orderStatus}}</p>
          <p>We are carefully preparing your items and will notify you once they are ready.</p>
        </div>
        
        <p>Thank you for your patience!</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 14px; color: #6b7280;">
            Best regards,<br>
            {{companyName}}
          </p>
        </div>
      </div>
    </body>
  </html>
  ',
  'Your Order #{{orderNumber}} is Being Prepared

Hi {{customerName}},

Great news! Your order #{{orderNumber}} is now being prepared by our team.

Status: {{orderStatus}}
We are carefully preparing your items and will notify you once they are ready.

Thank you for your patience!

Best regards,
{{companyName}}',
  ARRAY['customerName', 'orderNumber', 'orderStatus', 'companyName'],
  'order',
  true
),
(
  'welcome_customer',
  'Welcome Email',
  'Welcome to {{companyName}}!',
  '
  <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Welcome to {{companyName}}!</h1>
        <p>Hi {{customerName}},</p>
        <p>Welcome to our community! We are excited to have you with us.</p>
        
        <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p>You can now enjoy:</p>
          <ul>
            <li>Easy online ordering</li>
            <li>Order tracking</li>
            <li>Exclusive offers and discounts</li>
            <li>Fast delivery or pickup options</li>
          </ul>
        </div>
        
        <p>Start exploring our delicious menu and place your first order today!</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{siteUrl}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Start Ordering
          </a>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 14px; color: #6b7280;">
            Best regards,<br>
            The {{companyName}} Team
          </p>
        </div>
      </div>
    </body>
  </html>
  ',
  'Welcome to {{companyName}}!

Hi {{customerName}},

Welcome to our community! We are excited to have you with us.

You can now enjoy:
- Easy online ordering
- Order tracking  
- Exclusive offers and discounts
- Fast delivery or pickup options

Start exploring our delicious menu and place your first order today!

Visit us at: {{siteUrl}}

Best regards,
The {{companyName}} Team',
  ARRAY['customerName', 'companyName', 'siteUrl'],
  'customer',
  true
);