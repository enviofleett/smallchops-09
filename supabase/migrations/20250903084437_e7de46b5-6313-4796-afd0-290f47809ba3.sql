-- Create missing email templates for order status changes

-- Order Out For Delivery Template
INSERT INTO enhanced_email_templates (
  template_key,
  template_name,
  subject_template,
  html_template,
  text_template,
  variables,
  category,
  is_active,
  template_type
) VALUES (
  'order_out_for_delivery',
  'Order Out For Delivery',
  'Your Order #{{order_number}} is Out for Delivery! 🚚',
  '<html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin-bottom: 10px;">🚚 Out for Delivery!</h1>
          <p style="color: #6b7280; font-size: 16px;">Your order is on its way to you</p>
        </div>
        
        <p>Hi {{customer_name}},</p>
        <p>Exciting news! Your order <strong>#{{order_number}}</strong> has been dispatched and is now out for delivery.</p>
        
        <div style="background: #dbeafe; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #3b82f6;">
          <h3 style="margin-top: 0; color: #1e40af;">Delivery Status</h3>
          <p><strong>Status:</strong> {{new_status}}</p>
          <p><strong>Updated:</strong> {{status_date}}</p>
          <p>Your order will be delivered soon. Please ensure someone is available to receive it.</p>
        </div>
        
        <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px;"><strong>Need help?</strong> Contact us at {{support_email}}</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="font-size: 14px; color: #6b7280;">
            Thank you for choosing {{business_name}}!<br>
            We appreciate your business.
          </p>
        </div>
      </div>
    </body>
  </html>',
  'Your Order #{{order_number}} is Out for Delivery! 🚚

Hi {{customer_name}},

Exciting news! Your order #{{order_number}} has been dispatched and is now out for delivery.

Status: {{new_status}}
Updated: {{status_date}}

Your order will be delivered soon. Please ensure someone is available to receive it.

Need help? Contact us at {{support_email}}

Thank you for choosing {{business_name}}!
We appreciate your business.',
  ARRAY['customer_name', 'order_number', 'new_status', 'status_date', 'support_email', 'business_name'],
  'transactional',
  true,
  'order'
) ON CONFLICT (template_key) DO UPDATE SET
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Order Cancelled Template
INSERT INTO enhanced_email_templates (
  template_key,
  template_name,
  subject_template,
  html_template,
  text_template,
  variables,
  category,
  is_active,
  template_type
) VALUES (
  'order_cancelled',
  'Order Cancelled',
  'Order #{{order_number}} has been Cancelled',
  '<html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #dc2626; margin-bottom: 10px;">Order Cancelled</h1>
          <p style="color: #6b7280; font-size: 16px;">We''ve cancelled your order as requested</p>
        </div>
        
        <p>Hi {{customer_name}},</p>
        <p>Your order <strong>#{{order_number}}</strong> has been cancelled.</p>
        
        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #dc2626;">
          <h3 style="margin-top: 0; color: #b91c1c;">Cancellation Details</h3>
          <p><strong>Status:</strong> {{new_status}}</p>
          <p><strong>Cancelled on:</strong> {{status_date}}</p>
          <p>If you paid for this order, your refund will be processed within 3-5 business days.</p>
        </div>
        
        <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px;"><strong>Questions about your cancellation?</strong> Contact us at {{support_email}}</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="font-size: 14px; color: #6b7280;">
            We''re sorry to see this order cancelled.<br>
            We hope to serve you again soon!<br><br>
            {{business_name}}
          </p>
        </div>
      </div>
    </body>
  </html>',
  'Order #{{order_number}} has been Cancelled

Hi {{customer_name}},

Your order #{{order_number}} has been cancelled.

Status: {{new_status}}
Cancelled on: {{status_date}}

If you paid for this order, your refund will be processed within 3-5 business days.

Questions about your cancellation? Contact us at {{support_email}}

We''re sorry to see this order cancelled.
We hope to serve you again soon!

{{business_name}}',
  ARRAY['customer_name', 'order_number', 'new_status', 'status_date', 'support_email', 'business_name'],
  'transactional',
  true,
  'order'
) ON CONFLICT (template_key) DO UPDATE SET
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Order Completed Template
INSERT INTO enhanced_email_templates (
  template_key,
  template_name,
  subject_template,
  html_template,
  text_template,
  variables,
  category,
  is_active,
  template_type
) VALUES (
  'order_completed',
  'Order Completed',
  '✅ Order #{{order_number}} Completed - Thank You!',
  '<html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #059669; margin-bottom: 10px;">✅ Order Completed!</h1>
          <p style="color: #6b7280; font-size: 16px;">Your order has been successfully completed</p>
        </div>
        
        <p>Hi {{customer_name}},</p>
        <p>Thank you! Your order <strong>#{{order_number}}</strong> has been completed successfully.</p>
        
        <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #059669;">
          <h3 style="margin-top: 0; color: #047857;">Order Summary</h3>
          <p><strong>Status:</strong> {{new_status}}</p>
          <p><strong>Completed on:</strong> {{status_date}}</p>
          <p>We hope you enjoyed your order! Your feedback means a lot to us.</p>
        </div>
        
        <div style="background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-weight: bold; color: #0369a1;">How was your experience?</p>
          <p style="margin: 5px 0 0 0; font-size: 14px;">We''d love to hear from you at {{support_email}}</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="font-size: 14px; color: #6b7280;">
            Thank you for choosing {{business_name}}!<br>
            We look forward to serving you again.
          </p>
        </div>
      </div>
    </body>
  </html>',
  '✅ Order #{{order_number}} Completed - Thank You!

Hi {{customer_name}},

Thank you! Your order #{{order_number}} has been completed successfully.

Status: {{new_status}}
Completed on: {{status_date}}

We hope you enjoyed your order! Your feedback means a lot to us.

How was your experience?
We''d love to hear from you at {{support_email}}

Thank you for choosing {{business_name}}!
We look forward to serving you again.',
  ARRAY['customer_name', 'order_number', 'new_status', 'status_date', 'support_email', 'business_name'],
  'transactional',
  true,
  'order'
) ON CONFLICT (template_key) DO UPDATE SET
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Order Returned Template
INSERT INTO enhanced_email_templates (
  template_key,
  template_name,
  subject_template,
  html_template,
  text_template,
  variables,
  category,
  is_active,
  template_type
) VALUES (
  'order_returned',
  'Order Returned',
  'Order #{{order_number}} Return Processed',
  '<html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #f59e0b; margin-bottom: 10px;">📦 Return Processed</h1>
          <p style="color: #6b7280; font-size: 16px;">Your return has been processed</p>
        </div>
        
        <p>Hi {{customer_name}},</p>
        <p>Your return for order <strong>#{{order_number}}</strong> has been processed.</p>
        
        <div style="background: #fffbeb; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b;">
          <h3 style="margin-top: 0; color: #d97706;">Return Details</h3>
          <p><strong>Status:</strong> {{new_status}}</p>
          <p><strong>Processed on:</strong> {{status_date}}</p>
          <p>Your refund will be processed within 3-5 business days to your original payment method.</p>
        </div>
        
        <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px;"><strong>Questions about your return?</strong> Contact us at {{support_email}}</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="font-size: 14px; color: #6b7280;">
            Thank you for choosing {{business_name}}.<br>
            We hope to serve you better next time!
          </p>
        </div>
      </div>
    </body>
  </html>',
  'Order #{{order_number}} Return Processed

Hi {{customer_name}},

Your return for order #{{order_number}} has been processed.

Status: {{new_status}}
Processed on: {{status_date}}

Your refund will be processed within 3-5 business days to your original payment method.

Questions about your return? Contact us at {{support_email}}

Thank you for choosing {{business_name}}.
We hope to serve you better next time!',
  ARRAY['customer_name', 'order_number', 'new_status', 'status_date', 'support_email', 'business_name'],
  'transactional',
  true,
  'order'
) ON CONFLICT (template_key) DO UPDATE SET
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Update existing templates to use consistent variable names

-- Update Order Ready template
UPDATE enhanced_email_templates 
SET 
  subject_template = 'Your Order #{{order_number}} is Ready for Pickup! 📦',
  html_template = '<html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #059669; margin-bottom: 10px;">📦 Ready for Pickup!</h1>
          <p style="color: #6b7280; font-size: 16px;">Your order is ready and waiting</p>
        </div>
        
        <p>Hi {{customer_name}},</p>
        <p>Great news! Your order <strong>#{{order_number}}</strong> is ready for pickup.</p>
        
        <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #059669;">
          <h3 style="margin-top: 0; color: #047857;">Pickup Details</h3>
          <p><strong>Status:</strong> {{new_status}}</p>
          <p><strong>Ready since:</strong> {{status_date}}</p>
          <p>Please come and collect your order at your earliest convenience.</p>
        </div>
        
        <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px;"><strong>Need directions or have questions?</strong> Contact us at {{support_email}}</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="font-size: 14px; color: #6b7280;">
            Thank you for choosing {{business_name}}!<br>
            We look forward to seeing you soon.
          </p>
        </div>
      </div>
    </body>
  </html>',
  text_template = 'Your Order #{{order_number}} is Ready for Pickup! 📦

Hi {{customer_name}},

Great news! Your order #{{order_number}} is ready for pickup.

Status: {{new_status}}
Ready since: {{status_date}}

Please come and collect your order at your earliest convenience.

Need directions or have questions? Contact us at {{support_email}}

Thank you for choosing {{business_name}}!
We look forward to seeing you soon.',
  variables = ARRAY['customer_name', 'order_number', 'new_status', 'status_date', 'support_email', 'business_name'],
  updated_at = NOW()
WHERE template_key = 'order_ready';

-- Update Order Delivered template  
UPDATE enhanced_email_templates 
SET 
  subject_template = '✅ Order #{{order_number}} Delivered Successfully!',
  html_template = '<html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #059669; margin-bottom: 10px;">✅ Delivered!</h1>
          <p style="color: #6b7280; font-size: 16px;">Your order has been successfully delivered</p>
        </div>
        
        <p>Hi {{customer_name}},</p>
        <p>Your order <strong>#{{order_number}}</strong> has been delivered successfully!</p>
        
        <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #059669;">
          <h3 style="margin-top: 0; color: #047857;">Delivery Confirmation</h3>
          <p><strong>Status:</strong> {{new_status}}</p>
          <p><strong>Delivered on:</strong> {{status_date}}</p>
          <p>We hope you enjoy your order!</p>
        </div>
        
        <div style="background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-weight: bold; color: #0369a1;">How was your delivery experience?</p>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Share your feedback at {{support_email}}</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="font-size: 14px; color: #6b7280;">
            Thank you for choosing {{business_name}}!<br>
            We hope to serve you again soon.
          </p>
        </div>
      </div>
    </body>
  </html>',
  text_template = '✅ Order #{{order_number}} Delivered Successfully!

Hi {{customer_name}},

Your order #{{order_number}} has been delivered successfully!

Status: {{new_status}}
Delivered on: {{status_date}}

We hope you enjoy your order!

How was your delivery experience?
Share your feedback at {{support_email}}

Thank you for choosing {{business_name}}!
We hope to serve you again soon.',
  variables = ARRAY['customer_name', 'order_number', 'new_status', 'status_date', 'support_email', 'business_name'],
  updated_at = NOW()
WHERE template_key = 'order_delivered';