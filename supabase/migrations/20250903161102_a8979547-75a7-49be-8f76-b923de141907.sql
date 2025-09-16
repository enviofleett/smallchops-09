-- Add comprehensive settings menu structure for permission matrix
-- Main settings tabs and their nested sub-tabs

-- First, update the existing settings menu to have proper parent structure
UPDATE menu_structure 
SET label = 'Settings Dashboard', 
    sort_order = 1 
WHERE key = 'settings';

-- Add main settings tabs
INSERT INTO menu_structure (key, label, parent_key, sort_order, permission_levels, is_active) VALUES
-- Communications main tab
('settings_communications', 'Communications', 'settings', 2, '["none", "view", "edit"]', true),
('settings_communications_branding', 'Branding & Design', 'settings_communications', 1, '["none", "view", "edit"]', true),
('settings_communications_content', 'Content Management', 'settings_communications', 2, '["none", "view", "edit"]', true),
('settings_communications_support', 'Support & WhatsApp', 'settings_communications', 3, '["none", "view", "edit"]', true),
('settings_communications_email_processing', 'Email Processing Queue', 'settings_communications', 4, '["none", "view", "edit"]', true),

-- Payments main tab
('settings_payments', 'Payment Settings', 'settings', 3, '["none", "view", "edit"]', true),
('settings_payments_providers', 'Payment Providers', 'settings_payments', 1, '["none", "view", "edit"]', true),
('settings_payments_pickup_points', 'Pickup Points', 'settings_payments', 2, '["none", "view", "edit"]', true),

-- Admin main tab
('settings_admin', 'Admin Management', 'settings', 4, '["none", "view", "edit"]', true),
('settings_admin_users', 'User Management', 'settings_admin', 1, '["none", "view", "edit"]', true),
('settings_admin_permissions', 'Permission Matrix', 'settings_admin', 2, '["none", "view", "edit"]', true),

-- Developer main tab (admin only)
('settings_developer', 'Developer Tools', 'settings', 5, '["none", "view", "edit"]', true),
('settings_developer_auth', 'Authentication API', 'settings_developer', 1, '["none", "view", "edit"]', true),
('settings_developer_buying_logic', 'Buying Logic API', 'settings_developer', 2, '["none", "view", "edit"]', true),
('settings_developer_checkout', 'Checkout Settings', 'settings_developer', 3, '["none", "view", "edit"]', true),
('settings_developer_payments_webhooks', 'Payment Webhooks', 'settings_developer', 4, '["none", "view", "edit"]', true),
('settings_developer_oauth', 'OAuth Configuration', 'settings_developer', 6, '["none", "view", "edit"]', true),
('settings_developer_registration_health', 'Registration Health', 'settings_developer', 7, '["none", "view", "edit"]', true),
('settings_developer_production_readiness', 'Production Readiness', 'settings_developer', 8, '["none", "view", "edit"]', true),
('settings_developer_performance', 'Performance Monitor', 'settings_developer', 9, '["none", "view", "edit"]', true),

-- Email system (nested under developer)
('settings_developer_email', 'Email System', 'settings_developer', 5, '["none", "view", "edit"]', true),
('settings_developer_email_credentials', 'Email Credentials', 'settings_developer_email', 1, '["none", "view", "edit"]', true),
('settings_developer_email_communications', 'SMTP Settings', 'settings_developer_email', 2, '["none", "view", "edit"]', true),
('settings_developer_email_processing', 'Processing Queue', 'settings_developer_email', 3, '["none", "view", "edit"]', true),
('settings_developer_email_monitoring', 'Delivery Monitor', 'settings_developer_email', 4, '["none", "view", "edit"]', true),
('settings_developer_email_analytics', 'Email Analytics', 'settings_developer_email', 5, '["none", "view", "edit"]', true)

ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  parent_key = EXCLUDED.parent_key,
  sort_order = EXCLUDED.sort_order,
  permission_levels = EXCLUDED.permission_levels,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();