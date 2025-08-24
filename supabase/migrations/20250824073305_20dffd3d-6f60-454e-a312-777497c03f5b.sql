-- Production Email System Migration: Remove Duplicates and Ensure Core Templates
-- Step 1: Ensure all critical email templates exist

-- Insert or update core templates that must exist
INSERT INTO enhanced_email_templates (
  template_key, template_name, subject_template, html_template, text_template, 
  variables, template_type, is_active, description
) VALUES 
-- Order Confirmation (Primary)
('order_confirmation', 'Order Confirmation', 
'Order Confirmation - {{order_number}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #f59e0b;">Order Confirmation</h1>
  <p>Hello {{customer_name}},</p>
  <p>Thank you for your order! Your order <strong>{{order_number}}</strong> has been confirmed.</p>
  <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
    <h3>Order Details:</h3>
    <p><strong>Order Number:</strong> {{order_number}}</p>
    <p><strong>Total Amount:</strong> {{order_total}}</p>
    <p><strong>Order Date:</strong> {{order_date}}</p>
  </div>
  <p>We will send you updates as your order progresses.</p>
  <p>Thank you for choosing {{store_name}}!</p>
</div>',
'Order Confirmation - {{order_number}}\n\nHello {{customer_name}}, your order {{order_number}} for {{order_total}} has been confirmed.',
'["customer_name", "order_number", "order_total", "order_date", "store_name"]',
'transactional', true, 'Primary order confirmation template'
),

-- Customer Welcome (Primary)
('customer_welcome', 'Customer Welcome Email',
'Welcome to {{store_name}}, {{customer_name}}!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #f59e0b;">Welcome to {{store_name}}!</h1>
  <p>Hello {{customer_name}},</p>
  <p>Thank you for joining us! We are excited to have you as part of our community.</p>
  <p>Start exploring our products and enjoy shopping with us.</p>
  <p>If you have any questions, feel free to contact us at {{support_email}}.</p>
  <p>Welcome aboard!</p>
</div>',
'Welcome to {{store_name}}!\n\nHello {{customer_name}}, thank you for joining us!',
'["customer_name", "store_name", "support_email"]',
'transactional', true, 'Primary customer welcome template'
),

-- Payment Confirmation
('payment_confirmation', 'Payment Confirmation',
'Payment Received - {{order_number}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #10b981;">Payment Confirmed</h1>
  <p>Hello {{customer_name}},</p>
  <p>We have received your payment for order <strong>{{order_number}}</strong>.</p>
  <div style="background: #ecfdf5; border: 1px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 5px;">
    <h3>Payment Details:</h3>
    <p><strong>Amount Paid:</strong> {{order_total}}</p>
    <p><strong>Payment Method:</strong> {{payment_method}}</p>
    <p><strong>Transaction ID:</strong> {{payment_reference}}</p>
  </div>
  <p>Your order is now being prepared.</p>
  <p>Thank you for your payment!</p>
</div>',
'Payment Received - {{order_number}}\n\nHello {{customer_name}}, payment received for {{order_total}}.',
'["customer_name", "order_number", "order_total", "payment_method", "payment_reference"]',
'transactional', true, 'Payment confirmation template'
),

-- SMTP Test Template
('smtp_test', 'SMTP Connection Test',
'SMTP Test - {{test_time}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #3b82f6;">✅ SMTP Connection Test</h1>
  <p>This is a test email to verify your SMTP configuration.</p>
  <p><strong>Test Time:</strong> {{test_time}}</p>
  <p><strong>SMTP Host:</strong> {{smtp_host}}</p>
  <p>If you received this email, your SMTP configuration is working correctly!</p>
</div>',
'SMTP Test - {{test_time}}\n\nYour SMTP configuration is working correctly!',
'["test_time", "smtp_host"]',
'system', true, 'SMTP connection test template'
)

ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  variables = EXCLUDED.variables,
  template_type = EXCLUDED.template_type,
  is_active = EXCLUDED.is_active,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Step 2: Deactivate duplicate templates to prevent confusion
UPDATE enhanced_email_templates 
SET is_active = false, 
    description = COALESCE(description, '') || ' [DUPLICATE - DEACTIVATED]'
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

-- Step 3: Create production email tracking and monitoring
CREATE TABLE IF NOT EXISTS email_production_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL,
  sent_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_email_production_metrics_template_key 
ON email_production_metrics(template_key);

-- Enable RLS
ALTER TABLE email_production_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage production metrics" ON email_production_metrics
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Service role can manage production metrics" ON email_production_metrics
FOR ALL USING (auth.role() = 'service_role');

-- Step 4: Create function to update production metrics
CREATE OR REPLACE FUNCTION update_email_production_metrics(
  p_template_key TEXT,
  p_success BOOLEAN
) RETURNS VOID AS $$
BEGIN
  INSERT INTO email_production_metrics (template_key, sent_count, success_count, failure_count, last_sent_at)
  VALUES (
    p_template_key, 
    1, 
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    NOW()
  )
  ON CONFLICT (template_key) DO UPDATE SET
    sent_count = email_production_metrics.sent_count + 1,
    success_count = email_production_metrics.success_count + (CASE WHEN p_success THEN 1 ELSE 0 END),
    failure_count = email_production_metrics.failure_count + (CASE WHEN p_success THEN 0 ELSE 1 END),
    last_sent_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;