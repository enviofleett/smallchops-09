-- PHASE 3: Template Key Standardization - Create simple mapping for consistent email operations

CREATE TABLE IF NOT EXISTS email_template_mapping (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    old_key text NOT NULL UNIQUE,
    new_key text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Insert standardized template mappings
INSERT INTO email_template_mapping (old_key, new_key) VALUES
('order_confirmed', 'order_confirmation'),
('order_preparing', 'order_status_update'),
('order_ready', 'order_status_update'),
('order_out_for_delivery', 'order_status_update'),
('order_delivered', 'order_status_update'),
('order_cancelled', 'order_status_update'),
('payment_confirmed', 'payment_confirmation'),
('admin_new_order', 'admin_notification')
ON CONFLICT (old_key) DO NOTHING;

-- Enable RLS
ALTER TABLE email_template_mapping ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public can read template mappings" ON email_template_mapping
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage template mappings" ON email_template_mapping
    FOR ALL USING (is_admin()) WITH CHECK (is_admin());