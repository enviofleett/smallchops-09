-- PHASE 1: Critical Configuration Fixes
-- =====================================

-- 1. Configure admin notification email in business_settings
UPDATE business_settings 
SET admin_notification_email = 'admin@starters.com'
WHERE admin_notification_email IS NULL;

-- 2. Enable SMTP processing
UPDATE communication_settings 
SET use_smtp = true,
    updated_at = NOW()
WHERE use_smtp = false;

-- 3. Populate enhanced_email_templates table with all missing templates
INSERT INTO enhanced_email_templates (template_key, template_name, subject_template, html_template, text_template, template_type, is_active, variables)
VALUES 
-- Standardized customer welcome template
('welcome', 'Customer Welcome Email', 
 'Welcome to {{business_name}}!', 
 '<h1>Welcome {{customer_name}}!</h1><p>Thank you for joining {{business_name}}. We''re excited to have you!</p><p>Start exploring our products and enjoy exclusive member benefits.</p>',
 'Welcome {{customer_name}}! Thank you for joining {{business_name}}. We''re excited to have you! Start exploring our products and enjoy exclusive member benefits.',
 'transactional', true, '["customer_name", "business_name"]'::jsonb),

-- Order confirmation template  
('order_confirmation', 'Order Confirmation',
 'Order Confirmation #{{order_id}}',
 '<h1>Order Confirmed!</h1><p>Thank you {{customer_name}}! Your order #{{order_id}} has been confirmed.</p><p>Total: {{total_amount}}</p><p>We''ll send you updates as your order progresses.</p>',
 'Order Confirmed! Thank you {{customer_name}}! Your order #{{order_id}} has been confirmed. Total: {{total_amount}}. We''ll send you updates as your order progresses.',
 'transactional', true, '["customer_name", "order_id", "total_amount"]'::jsonb),

-- Order status update template
('order_status_update', 'Order Status Update',
 'Order #{{order_id}} - {{status}}',
 '<h1>Order Update</h1><p>Your order #{{order_id}} status has been updated to: <strong>{{status}}</strong></p><p>{{status_message}}</p>',
 'Order Update: Your order #{{order_id}} status has been updated to: {{status}}. {{status_message}}',
 'transactional', true, '["order_id", "status", "status_message"]'::jsonb),

-- Payment confirmation template
('payment_confirmation', 'Payment Confirmation',
 'Payment Received - Order #{{order_id}}',
 '<h1>Payment Confirmed</h1><p>We''ve received your payment of {{amount}} for order #{{order_id}}.</p><p>Your order is now being processed.</p>',
 'Payment Confirmed: We''ve received your payment of {{amount}} for order #{{order_id}}. Your order is now being processed.',
 'transactional', true, '["order_id", "amount"]'::jsonb),

-- Shipping notification template
('shipping_notification', 'Shipping Notification',
 'Your order #{{order_id}} has shipped!',
 '<h1>Order Shipped!</h1><p>Great news! Your order #{{order_id}} is on its way.</p><p>Tracking: {{tracking_number}}</p><p>Expected delivery: {{estimated_delivery}}</p>',
 'Order Shipped! Your order #{{order_id}} is on its way. Tracking: {{tracking_number}}. Expected delivery: {{estimated_delivery}}',
 'transactional', true, '["order_id", "tracking_number", "estimated_delivery"]'::jsonb),

-- Cart abandonment template
('cart_abandonment', 'Cart Abandonment Reminder',
 'You left something in your cart!',
 '<h1>Don''t forget your items!</h1><p>Hi {{customer_name}}, you have {{item_count}} items waiting in your cart.</p><p>Complete your purchase now and get {{total_amount}} worth of great products!</p>',
 'Don''t forget your items! Hi {{customer_name}}, you have {{item_count}} items waiting in your cart. Complete your purchase now!',
 'marketing', true, '["customer_name", "item_count", "total_amount"]'::jsonb),

-- Admin new order notification
('admin_order_notification', 'New Order Alert',
 'New Order #{{order_id}} - {{total_amount}}',
 '<h1>New Order Received</h1><p>Order ID: {{order_id}}</p><p>Customer: {{customer_name}} ({{customer_email}})</p><p>Total: {{total_amount}}</p><p>Items: {{item_count}}</p>',
 'New Order: #{{order_id}} from {{customer_name}} ({{customer_email}}) - {{total_amount}} for {{item_count}} items',
 'transactional', true, '["order_id", "customer_name", "customer_email", "total_amount", "item_count"]'::jsonb),

-- Order delivered notification
('order_delivered', 'Order Delivered',
 'Your order #{{order_id}} has been delivered!',
 '<h1>Order Delivered!</h1><p>Your order #{{order_id}} has been successfully delivered.</p><p>We hope you love your purchase! Please consider leaving a review.</p>',
 'Order Delivered! Your order #{{order_id}} has been successfully delivered. We hope you love your purchase!',
 'transactional', true, '["order_id"]'::jsonb),

-- Welcome series email 1
('welcome_series_day1', 'Welcome Series - Day 1',
 'Welcome to {{business_name}} - Let''s get started!',
 '<h1>Welcome {{customer_name}}!</h1><p>We''re thrilled you''ve joined the {{business_name}} family!</p><p>Here''s what you can expect:</p><ul><li>Exclusive member discounts</li><li>Early access to new products</li><li>Personalized recommendations</li></ul>',
 'Welcome {{customer_name}}! We''re thrilled you''ve joined the {{business_name}} family! Enjoy exclusive member discounts, early access to new products, and personalized recommendations.',
 'marketing', true, '["customer_name", "business_name"]'::jsonb),

-- Review request template
('review_request', 'How was your order?',
 'How did we do with order #{{order_id}}?',
 '<h1>We''d love your feedback!</h1><p>Hi {{customer_name}}, how was your recent order (#{{order_id}})?</p><p>Your review helps other customers and helps us improve our service.</p>',
 'Hi {{customer_name}}, how was your recent order (#{{order_id}})? Your review helps other customers and helps us improve our service.',
 'marketing', true, '["customer_name", "order_id"]'::jsonb)

ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  template_type = EXCLUDED.template_type,
  is_active = EXCLUDED.is_active,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- 4. Create order status change trigger
CREATE OR REPLACE FUNCTION trigger_order_status_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for actual status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Insert communication event for customer
    INSERT INTO communication_events (
      event_type,
      recipient_email,
      order_id,
      template_key,
      variables,
      priority,
      status
    ) VALUES (
      'order_status_update',
      NEW.customer_email,
      NEW.id,
      CASE 
        WHEN NEW.status = 'shipped' THEN 'shipping_notification'
        WHEN NEW.status = 'delivered' THEN 'order_delivered'
        ELSE 'order_status_update'
      END,
      jsonb_build_object(
        'customer_name', NEW.customer_name,
        'order_id', NEW.id::text,
        'status', NEW.status,
        'status_message', 
          CASE NEW.status
            WHEN 'processing' THEN 'Your order is being prepared'
            WHEN 'shipped' THEN 'Your order is on its way!'
            WHEN 'delivered' THEN 'Your order has been delivered'
            WHEN 'cancelled' THEN 'Your order has been cancelled'
            ELSE 'Order status updated'
          END,
        'tracking_number', COALESCE(NEW.tracking_number, ''),
        'estimated_delivery', COALESCE(NEW.estimated_delivery_date::text, '')
      ),
      CASE 
        WHEN NEW.status IN ('shipped', 'delivered') THEN 'high'
        ELSE 'normal'
      END,
      'queued'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS order_status_change_email ON orders;
CREATE TRIGGER order_status_change_email
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_order_status_email();

-- 5. Create cart abandonment tracking table
CREATE TABLE IF NOT EXISTS cart_abandonment_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  customer_email TEXT,
  customer_id UUID,
  cart_data JSONB NOT NULL DEFAULT '[]',
  total_value NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  abandoned_at TIMESTAMPTZ,
  recovery_email_sent_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  is_abandoned BOOLEAN DEFAULT false
);

-- Enable RLS on cart abandonment tracking
ALTER TABLE cart_abandonment_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies for cart abandonment tracking
CREATE POLICY "Service roles can manage cart abandonment tracking"
ON cart_abandonment_tracking FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view cart abandonment tracking"
ON cart_abandonment_tracking FOR SELECT
USING (is_admin());

-- 6. Update communication_events to use standardized template keys
UPDATE communication_events 
SET template_key = 'welcome'
WHERE template_key IN ('customer_welcome', 'welcome_customer')
AND event_type = 'customer_welcome';

UPDATE communication_events 
SET template_key = 'order_confirmation'
WHERE template_key = 'order_confirmation_clean'
AND event_type = 'order_confirmation';

UPDATE communication_events 
SET template_key = 'admin_order_notification'
WHERE template_key = 'admin_new_order'
AND event_type = 'admin_new_order';

-- 7. Create email automation configuration table
CREATE TABLE IF NOT EXISTS email_automation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_type TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN DEFAULT true,
  trigger_delay_minutes INTEGER DEFAULT 0,
  template_key TEXT NOT NULL,
  conditions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert automation configurations
INSERT INTO email_automation_config (automation_type, template_key, trigger_delay_minutes, is_enabled)
VALUES 
('cart_abandonment', 'cart_abandonment', 60, true),
('welcome_series_day1', 'welcome_series_day1', 1440, true), -- 24 hours
('review_request', 'review_request', 10080, true), -- 7 days
('order_status_change', 'order_status_update', 0, true)
ON CONFLICT (automation_type) DO UPDATE SET
  template_key = EXCLUDED.template_key,
  trigger_delay_minutes = EXCLUDED.trigger_delay_minutes,
  updated_at = NOW();

-- Log Phase 1 completion
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'email_system_phase1_complete',
  'Email System',
  'Completed Phase 1: Critical Configuration Fixes',
  jsonb_build_object(
    'admin_email_configured', true,
    'smtp_enabled', true,
    'templates_populated', 10,
    'triggers_created', true,
    'automation_config_created', true
  )
);