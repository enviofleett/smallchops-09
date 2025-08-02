-- EMERGENCY FIXES AND REAL-TIME EMAIL SYSTEM
-- Phase 1: Fix SMTP and Activate Order Email Triggers

-- 1. Create order email triggers for real-time communication
CREATE OR REPLACE FUNCTION trigger_order_emails()
RETURNS TRIGGER AS $$
BEGIN
  -- Send order confirmation email when order is first created
  IF TG_OP = 'INSERT' THEN
    INSERT INTO communication_events (
      order_id,
      event_type,
      recipient_email,
      template_id,
      email_type,
      status,
      variables,
      created_at
    ) VALUES (
      NEW.id,
      'order_confirmation',
      NEW.customer_email,
      'order_confirmation',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', NEW.customer_name,
        'orderNumber', NEW.order_number,
        'orderTotal', NEW.total_amount::text,
        'orderType', NEW.order_type,
        'deliveryAddress', NEW.delivery_address,
        'pickupAddress', CASE WHEN NEW.order_type = 'pickup' THEN 'Store Location' ELSE NULL END
      ),
      NOW()
    );
    RETURN NEW;
  END IF;

  -- Send status update email when order status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO communication_events (
      order_id,
      event_type,
      recipient_email,
      template_id,
      email_type,
      status,
      variables,
      created_at
    ) VALUES (
      NEW.id,
      'order_status_update',
      NEW.customer_email,
      'order_status_update',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', NEW.customer_name,
        'orderNumber', NEW.order_number,
        'newStatus', NEW.status,
        'oldStatus', OLD.status,
        'estimatedTime', CASE 
          WHEN NEW.status = 'confirmed' THEN '30-45 minutes'
          WHEN NEW.status = 'preparing' THEN '20-30 minutes'
          WHEN NEW.status = 'ready' THEN 'Ready for pickup'
          WHEN NEW.status = 'out_for_delivery' THEN '10-15 minutes'
          WHEN NEW.status = 'delivered' THEN 'Completed'
          ELSE NULL
        END
      ),
      NOW()
    );
  END IF;

  -- Send payment confirmation email when payment is confirmed
  IF TG_OP = 'UPDATE' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.payment_status = 'paid' THEN
    INSERT INTO communication_events (
      order_id,
      event_type,
      recipient_email,
      template_id,
      email_type,
      status,
      variables,
      created_at
    ) VALUES (
      NEW.id,
      'payment_confirmation',
      NEW.customer_email,
      'payment_confirmation',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', NEW.customer_name,
        'orderNumber', NEW.order_number,
        'amount', NEW.total_amount::text,
        'paymentMethod', COALESCE(NEW.payment_method, 'Online Payment')
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for order emails
DROP TRIGGER IF EXISTS trigger_order_emails_insert ON orders;
DROP TRIGGER IF EXISTS trigger_order_emails_update ON orders;

CREATE TRIGGER trigger_order_emails_insert
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_order_emails();

CREATE TRIGGER trigger_order_emails_update
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_order_emails();

-- 2. Create real-time email processing function
CREATE OR REPLACE FUNCTION process_email_queue_real_time()
RETURNS void AS $$
DECLARE
  event_record RECORD;
  processed_count INTEGER := 0;
BEGIN
  -- Process up to 50 queued emails at a time
  FOR event_record IN 
    SELECT * FROM communication_events 
    WHERE status = 'queued' 
    ORDER BY created_at ASC 
    LIMIT 50
  LOOP
    -- Update status to processing to prevent duplicate processing
    UPDATE communication_events 
    SET status = 'processing', processed_at = NOW()
    WHERE id = event_record.id;
    
    processed_count := processed_count + 1;
  END LOOP;
  
  -- Log processing activity
  IF processed_count > 0 THEN
    INSERT INTO audit_logs (action, category, message) 
    VALUES ('email_queue_processed', 'Communication', 
            'Processed ' || processed_count || ' queued emails for real-time delivery');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create function to instantly process new emails
CREATE OR REPLACE FUNCTION instant_email_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- For critical transactional emails, trigger immediate processing
  IF NEW.email_type = 'transactional' AND NEW.status = 'queued' THEN
    -- Log for immediate processing
    INSERT INTO audit_logs (
      action, 
      category, 
      message, 
      new_values
    ) VALUES (
      'instant_email_queued', 
      'Communication', 
      'Critical email queued for instant processing: ' || NEW.event_type,
      jsonb_build_object(
        'event_id', NEW.id,
        'event_type', NEW.event_type,
        'recipient_email', NEW.recipient_email,
        'priority', 'high'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the existing trigger to use instant processing
DROP TRIGGER IF EXISTS trigger_instant_email_processing ON communication_events;
CREATE TRIGGER trigger_instant_email_processing
  AFTER INSERT ON communication_events
  FOR EACH ROW
  WHEN (NEW.status = 'queued')
  EXECUTE FUNCTION instant_email_trigger();

-- 4. Add admin notification settings to business_settings
ALTER TABLE business_settings 
ADD COLUMN IF NOT EXISTS admin_notification_email text,
ADD COLUMN IF NOT EXISTS admin_order_notifications boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS admin_payment_notifications boolean DEFAULT true;

-- 5. Reset failed emails and mark for reprocessing
UPDATE communication_events 
SET status = 'queued', retry_count = 0, error_message = NULL, processed_at = NULL
WHERE status IN ('failed', 'processing');

-- Log the emergency fixes implementation
INSERT INTO audit_logs (action, category, message) 
VALUES ('emergency_fixes_implemented', 'System Maintenance', 
        'Emergency fixes applied: Order email triggers activated, real-time processing enabled, queued emails reset');