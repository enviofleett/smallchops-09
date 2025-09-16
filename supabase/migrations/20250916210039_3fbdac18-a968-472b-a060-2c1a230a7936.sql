-- Add SMS-specific columns to notification_delivery_log table
ALTER TABLE notification_delivery_log ADD COLUMN IF NOT EXISTS sms_provider_message_id TEXT;
ALTER TABLE notification_delivery_log ADD COLUMN IF NOT EXISTS sms_cost DECIMAL(10,4);
ALTER TABLE notification_delivery_log ADD COLUMN IF NOT EXISTS delivery_report_status TEXT;
ALTER TABLE notification_delivery_log ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add SMS preferences to customer_accounts
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN DEFAULT true;
ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS sms_marketing_consent BOOLEAN DEFAULT false;

-- Log completion
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'sms_integration_columns_added',
  'SMS System',
  'SMS-specific columns added to existing tables',
  jsonb_build_object(
    'tables_updated', jsonb_build_array('notification_delivery_log', 'customer_accounts'),
    'status', 'complete'
  )
);