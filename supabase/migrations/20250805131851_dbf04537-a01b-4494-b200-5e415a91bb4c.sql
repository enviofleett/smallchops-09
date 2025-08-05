-- Fix existing communication events with NULL template keys
-- This will assign correct template keys based on event_type

UPDATE communication_events 
SET 
  template_key = CASE 
    WHEN event_type = 'order_confirmation' THEN 'order_confirmation_clean'
    WHEN event_type = 'admin_new_order' THEN 'admin_new_order'
    WHEN event_type = 'customer_welcome' THEN 'customer_welcome'
    WHEN event_type = 'payment_confirmation' THEN 'order_confirmation_clean'
    ELSE template_key
  END,
  updated_at = NOW()
WHERE template_key IS NULL 
  AND event_type IN ('order_confirmation', 'admin_new_order', 'customer_welcome', 'payment_confirmation');

-- Log the data migration
INSERT INTO audit_logs (action, category, message, new_values) 
VALUES (
  'template_key_migration',
  'Email System',
  'Fixed NULL template keys in communication events',
  jsonb_build_object(
    'migration_date', NOW(),
    'events_updated', (
      SELECT COUNT(*) 
      FROM communication_events 
      WHERE template_key IN ('order_confirmation_clean', 'admin_new_order', 'customer_welcome')
      AND updated_at >= NOW() - INTERVAL '1 minute'
    )
  )
);