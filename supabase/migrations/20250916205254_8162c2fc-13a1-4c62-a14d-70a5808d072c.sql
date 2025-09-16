-- Create SMS Tables and Setup (Simplified approach)

-- Drop and recreate SMS templates table to ensure clean state
DROP TABLE IF EXISTS sms_templates CASCADE;
CREATE TABLE sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  template_name TEXT NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  category TEXT DEFAULT 'order_status',
  is_active BOOLEAN DEFAULT true,
  max_length INTEGER DEFAULT 160,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Drop and recreate SMS configuration table to ensure clean state
DROP TABLE IF EXISTS sms_configuration CASCADE;
CREATE TABLE sms_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT DEFAULT 'mysmstab',
  sender_id TEXT NOT NULL DEFAULT 'Starters',
  is_active BOOLEAN DEFAULT true,
  rate_limit_per_minute INTEGER DEFAULT 10,
  cost_per_sms DECIMAL(10,4) DEFAULT 0.50,
  balance_threshold DECIMAL(10,2) DEFAULT 100.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Enable RLS on SMS tables
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_configuration ENABLE ROW LEVEL SECURITY;

-- Create policies for SMS templates
CREATE POLICY "Admins can manage SMS templates" ON sms_templates
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Service roles can read SMS templates" ON sms_templates
  FOR SELECT USING (auth.role() = 'service_role');

-- Create policies for SMS configuration
CREATE POLICY "Admins can manage SMS configuration" ON sms_configuration
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Service roles can read SMS configuration" ON sms_configuration
  FOR SELECT USING (auth.role() = 'service_role');

-- Insert default SMS templates
INSERT INTO sms_templates (template_key, template_name, content, variables, category) VALUES
  ('order_confirmed', 'Order Confirmed', 'Hi {{customer_name}}, your order #{{order_number}} has been confirmed! Total: ₦{{total_amount}}. Track: {{tracking_url}}', 
   '["customer_name", "order_number", "total_amount", "tracking_url"]'::jsonb, 'order_status'),
  ('order_preparing', 'Order Preparing', 'Good news! Your order #{{order_number}} is being prepared. We''ll notify you when it''s ready.', 
   '["order_number"]'::jsonb, 'order_status'),
  ('order_ready', 'Order Ready', 'Your order #{{order_number}} is ready for pickup/delivery! {{pickup_address}}', 
   '["order_number", "pickup_address"]'::jsonb, 'order_status'),
  ('order_out_for_delivery', 'Out for Delivery', 'Your order #{{order_number}} is on its way! Expected delivery: {{delivery_time}}.', 
   '["order_number", "delivery_time"]'::jsonb, 'order_status'),
  ('order_delivered', 'Order Delivered', 'Your order #{{order_number}} has been delivered! Thank you for choosing us. Rate your experience: {{rating_url}}', 
   '["order_number", "rating_url"]'::jsonb, 'order_status'),
  ('order_cancelled', 'Order Cancelled', 'Your order #{{order_number}} has been cancelled. Refund will be processed within 3-5 business days.', 
   '["order_number"]'::jsonb, 'order_status');

-- Insert default SMS configuration
INSERT INTO sms_configuration (provider, sender_id, is_active, rate_limit_per_minute, cost_per_sms, balance_threshold) VALUES
  ('mysmstab', 'Starters', true, 10, 0.50, 100.00);

-- Create trigger function
CREATE OR REPLACE FUNCTION update_sms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers
CREATE TRIGGER update_sms_templates_updated_at
    BEFORE UPDATE ON sms_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_sms_updated_at();

CREATE TRIGGER update_sms_configuration_updated_at
    BEFORE UPDATE ON sms_configuration
    FOR EACH ROW
    EXECUTE FUNCTION update_sms_updated_at();

-- Log SMS integration setup
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'sms_integration_initialized',
  'SMS System',
  'SMS integration tables and templates created successfully',
  jsonb_build_object(
    'tables_created', jsonb_build_array('sms_templates', 'sms_configuration'),
    'default_templates', 6,
    'provider', 'mysmstab',
    'status', 'ready'
  )
);