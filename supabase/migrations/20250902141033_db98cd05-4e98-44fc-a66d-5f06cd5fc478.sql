-- Create trigger to validate email events before processing
CREATE OR REPLACE FUNCTION validate_communication_event_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate email events
  IF NEW.event_type IN ('payment_confirmation', 'order_confirmation', 'welcome_email', 'customer_welcome') THEN
    -- Check if recipient_email is valid
    IF NEW.recipient_email IS NULL OR NEW.recipient_email = '' OR NOT (NEW.recipient_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
      -- Mark as failed immediately
      NEW.status := 'failed';
      NEW.error_message := 'Invalid or missing recipient email address';
      NEW.updated_at := NOW();
      
      -- Log the validation failure
      INSERT INTO audit_logs (
        action, category, message, entity_id, new_values
      ) VALUES (
        'email_validation_failed',
        'Email System',
        'Email event failed validation: ' || COALESCE(NEW.recipient_email, 'NULL'),
        NEW.id,
        jsonb_build_object(
          'event_type', NEW.event_type,
          'recipient_email', COALESCE(NEW.recipient_email, 'NULL'),
          'template_key', NEW.template_key
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on communication_events
DROP TRIGGER IF EXISTS validate_email_before_processing ON communication_events;
CREATE TRIGGER validate_email_before_processing
  BEFORE INSERT OR UPDATE ON communication_events
  FOR EACH ROW
  EXECUTE FUNCTION validate_communication_event_email();

-- Ensure payment_confirmation template exists
INSERT INTO enhanced_email_templates (
  template_key,
  name,
  subject_template,
  html_template,
  text_template,
  is_active,
  event_type,
  created_at,
  updated_at
) VALUES (
  'payment_confirmation',
  'Payment Confirmation',
  'Payment Confirmed - Order {{orderNumber}}',
  '<html><body><h2>Payment Confirmed!</h2><p>Dear {{customerName}},</p><p>Your payment of {{amount}} has been confirmed for order {{orderNumber}}.</p><p>Thank you for your business!</p></body></html>',
  'Payment Confirmed! Dear {{customerName}}, Your payment of {{amount}} has been confirmed for order {{orderNumber}}. Thank you for your business!',
  true,
  'payment_confirmation',
  NOW(),
  NOW()
) ON CONFLICT (template_key) 
DO UPDATE SET 
  is_active = true,
  updated_at = NOW();

-- Clean up existing bad queued events
UPDATE communication_events 
SET 
  status = 'failed',
  error_message = 'Invalid recipient email - cleaned up during system maintenance',
  updated_at = NOW()
WHERE status = 'queued' 
  AND (recipient_email IS NULL OR recipient_email = '' OR NOT (recipient_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'));