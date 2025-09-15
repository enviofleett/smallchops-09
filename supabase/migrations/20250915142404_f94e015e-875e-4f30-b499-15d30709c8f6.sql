-- Phase 1: Fix authentication and email system issues (corrected)

-- 1. Add missing SMTP environment variables to communication_settings if they don't exist
INSERT INTO communication_settings (
  smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, sender_name, sender_email, use_smtp, production_mode
) 
SELECT 
  'smtp.gmail.com', 587, 'support@startersmallchops.com', NULL, true, 
  'Starters Small Chops', 'support@startersmallchops.com', true, true
WHERE NOT EXISTS (SELECT 1 FROM communication_settings WHERE use_smtp = true);

-- 2. Fix communication_events dedupe constraint issues by updating the constraint to be more flexible
ALTER TABLE communication_events DROP CONSTRAINT IF EXISTS communication_events_dedupe_key_key;

-- 3. Create a more flexible unique constraint that allows better handling
CREATE UNIQUE INDEX IF NOT EXISTS communication_events_dedupe_flexible 
ON communication_events (dedupe_key) 
WHERE dedupe_key IS NOT NULL AND status != 'failed';

-- 4. Clear old failed events by marking them as failed (using proper enum value)
UPDATE communication_events 
SET status = 'failed', updated_at = NOW(), error_message = 'Cleared during production cleanup'
WHERE status = 'failed' 
  AND created_at < NOW() - INTERVAL '24 hours'
  AND error_message IS NULL;

-- 5. Reset stuck queued events that are older than 1 hour to allow retry
UPDATE communication_events 
SET status = 'queued', retry_count = 0, updated_at = NOW(), error_message = NULL
WHERE status = 'processing' 
  AND created_at < NOW() - INTERVAL '1 hour';

-- 6. Add audit logging for order status changes with email triggers
CREATE OR REPLACE FUNCTION log_order_status_change_with_email()
RETURNS TRIGGER AS $$
DECLARE
  event_id UUID;
BEGIN
  -- Log status changes and trigger emails
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Log the status change
    INSERT INTO audit_logs (
      action, category, message, user_id, entity_id, old_values, new_values
    ) VALUES (
      'order_status_changed',
      'Order Management', 
      'Order status changed from ' || COALESCE(OLD.status, 'null') || ' to ' || NEW.status,
      auth.uid(),
      NEW.id,
      jsonb_build_object('old_status', OLD.status),
      jsonb_build_object('new_status', NEW.status, 'order_number', NEW.order_number)
    );
    
    -- Queue customer notification email for important status changes
    IF NEW.status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') 
       AND NEW.customer_email IS NOT NULL THEN
      
      SELECT upsert_communication_event(
        'order_status_update',
        NEW.customer_email,
        COALESCE(NEW.customer_name, 'Customer'),
        'order_status_' || NEW.status,
        jsonb_build_object(
          'customer_name', COALESCE(NEW.customer_name, 'Customer'),
          'order_number', NEW.order_number,
          'status', NEW.status,
          'order_total', NEW.total_amount,
          'delivery_address', NEW.delivery_address
        ),
        NEW.id,
        NEW.id::text || '_status_' || NEW.status || '_' || EXTRACT(EPOCH FROM NOW())::bigint::text
      ) INTO event_id;
      
      IF event_id IS NOT NULL THEN
        INSERT INTO audit_logs (
          action, category, message, entity_id, new_values
        ) VALUES (
          'email_queued_status_change',
          'Communication',
          'Email queued for order status change: ' || NEW.status,
          NEW.id,
          jsonb_build_object('email_event_id', event_id, 'status', NEW.status)
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace the existing trigger if it exists
DROP TRIGGER IF EXISTS order_status_change_with_email_trigger ON orders;
CREATE TRIGGER order_status_change_with_email_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change_with_email();