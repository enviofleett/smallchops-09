-- Remove legacy email processing triggers and functions

-- Drop any triggers that reference legacy processors
DROP TRIGGER IF EXISTS trigger_enhanced_email_processor_on_orders ON orders;
DROP TRIGGER IF EXISTS trigger_production_email_on_payment ON payment_transactions;

-- Update any remaining communication event processors to use unified system
UPDATE communication_events 
SET 
  email_provider = 'smtp',
  template_key = CASE 
    WHEN template_key = 'order_confirmed' THEN 'order_confirmation'
    WHEN template_key IS NULL AND event_type = 'customer_welcome' THEN 'welcome_email'
    WHEN template_key IS NULL AND event_type = 'payment_confirmation' THEN 'payment_confirmation'
    ELSE template_key
  END,
  updated_at = NOW()
WHERE email_provider IN ('production_smtp', 'enhanced_smtp', 'native_smtp')
   OR template_key = 'order_confirmed'
   OR (template_key IS NULL AND event_type IN ('customer_welcome', 'payment_confirmation'));

-- Clean up any orphaned email processing records
DELETE FROM audit_logs 
WHERE action IN ('enhanced_email_processing', 'production_smtp_sending', 'native_smtp_processing')
  AND created_at < NOW() - INTERVAL '30 days';

-- Update SMTP provider configurations to use unified system
UPDATE communication_settings 
SET 
  email_provider = 'smtp',
  updated_at = NOW()
WHERE email_provider IN ('production_smtp', 'enhanced_smtp', 'native_smtp');

-- Insert audit log for migration completion
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'legacy_email_cleanup_completed',
  'Email System Migration',
  'Successfully cleaned up legacy email processors and unified to single SMTP system',
  jsonb_build_object(
    'unified_system', 'unified-smtp-sender',
    'queue_processor', 'unified-email-queue-processor',
    'instant_processor', 'instant-email-processor',
    'migration_date', NOW()
  )
);