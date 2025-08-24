-- Production Email System Migration: Remove Duplicates and Ensure Core Templates
-- Step 1: Check current schema and add missing columns if needed
ALTER TABLE enhanced_email_templates 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Step 2: Ensure all critical email templates exist
INSERT INTO enhanced_email_templates (
  template_key, template_name, subject_template, html_template, text_template, 
  variables, template_type, is_active
) VALUES 
-- Order Confirmation (Primary)
('order_confirmation', 'Order Confirmation', 
'Order Confirmation - {{order_number}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  <h1 style="color: #f59e0b; text-align: center;">Order Confirmation</h1>
  <p>Hello {{customer_name}},</p>
  <p>Thank you for your order! Your order <strong>{{order_number}}</strong> has been confirmed.</p>
  <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #f59e0b;">
    <h3 style="margin-top: 0;">Order Details:</h3>
    <p><strong>Order Number:</strong> {{order_number}}</p>
    <p><strong>Total Amount:</strong> {{order_total}}</p>
    <p><strong>Order Date:</strong> {{order_date}}</p>
  </div>
  <p>We will send you updates as your order progresses.</p>
  <p style="text-align: center; margin-top: 30px;">
    <strong>Thank you for choosing {{store_name}}!</strong>
  </p>
</div>',
'Order Confirmation - {{order_number}}\n\nHello {{customer_name}}, your order {{order_number}} for {{order_total}} has been confirmed.',
'["customer_name", "order_number", "order_total", "order_date", "store_name"]',
'transactional', true
),

-- Customer Welcome (Primary)
('customer_welcome', 'Customer Welcome Email',
'Welcome to {{store_name}}, {{customer_name}}!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  <h1 style="color: #f59e0b; text-align: center;">Welcome to {{store_name}}!</h1>
  <p>Hello {{customer_name}},</p>
  <p>Thank you for joining us! We are excited to have you as part of our community.</p>
  <div style="background: #f0f9ff; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #3b82f6;">
    <p>🎉 <strong>You are now part of our family!</strong></p>
    <p>Start exploring our delicious small chops and enjoy shopping with us.</p>
  </div>
  <p>If you have any questions, feel free to contact us at {{support_email}}.</p>
  <p style="text-align: center; margin-top: 30px;">
    <strong>Welcome aboard!</strong>
  </p>
</div>',
'Welcome to {{store_name}}!\n\nHello {{customer_name}}, thank you for joining us!',
'["customer_name", "store_name", "support_email"]',
'transactional', true
),

-- Payment Confirmation
('payment_confirmation', 'Payment Confirmation',
'Payment Received - {{order_number}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  <h1 style="color: #10b981; text-align: center;">💰 Payment Confirmed</h1>
  <p>Hello {{customer_name}},</p>
  <p>We have received your payment for order <strong>{{order_number}}</strong>.</p>
  <div style="background: #ecfdf5; border: 1px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 5px;">
    <h3 style="margin-top: 0; color: #065f46;">Payment Details:</h3>
    <p><strong>Amount Paid:</strong> {{order_total}}</p>
    <p><strong>Payment Method:</strong> {{payment_method}}</p>
    <p><strong>Transaction ID:</strong> {{payment_reference}}</p>
  </div>
  <p>Your order is now being prepared.</p>
  <p style="text-align: center; margin-top: 30px;">
    <strong>Thank you for your payment!</strong>
  </p>
</div>',
'Payment Received - {{order_number}}\n\nHello {{customer_name}}, payment received for {{order_total}}.',
'["customer_name", "order_number", "order_total", "payment_method", "payment_reference"]',
'transactional', true
),

-- SMTP Test Template
('smtp_test', 'SMTP Connection Test',
'SMTP Test - {{test_time}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  <h1 style="color: #3b82f6; text-align: center;">✅ SMTP Connection Test</h1>
  <p>This is a test email to verify your SMTP configuration.</p>
  <div style="background: #eff6ff; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #3b82f6;">
    <p><strong>Test Time:</strong> {{test_time}}</p>
    <p><strong>SMTP Host:</strong> {{smtp_host}}</p>
  </div>
  <p style="text-align: center; color: #10b981; font-weight: bold;">
    ✅ If you received this email, your SMTP configuration is working correctly!
  </p>
</div>',
'SMTP Test - {{test_time}}\n\nYour SMTP configuration is working correctly!',
'["test_time", "smtp_host"]',
'system', true
)

ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  variables = EXCLUDED.variables,
  template_type = EXCLUDED.template_type,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Step 3: Deactivate duplicate templates to prevent confusion in production
UPDATE enhanced_email_templates 
SET is_active = false
WHERE template_key IN (
  'order_confirmed',      -- duplicate of order_confirmation
  'welcome',              -- duplicate of customer_welcome  
  'welcome_customer',     -- duplicate of customer_welcome
  'order_confirmation_bold',     -- stylistic variant
  'order_confirmation_clean',    -- stylistic variant
  'order_confirmation_elegant',  -- stylistic variant
  'order_confirmation_modern',   -- stylistic variant
  'welcome_series_clean',        -- stylistic variant
  'welcome_series_modern',       -- stylistic variant
  'abandoned_cart_bold',         -- stylistic variant
  'abandoned_cart_clean',        -- stylistic variant
  'abandoned_cart_modern',       -- stylistic variant
  'shipping_update_bold',        -- stylistic variant
  'shipping_update_clean',       -- stylistic variant
  'shipping_update_modern'       -- stylistic variant
) AND is_active = true;