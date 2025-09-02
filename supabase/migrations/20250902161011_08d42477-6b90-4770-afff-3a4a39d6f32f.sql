-- Production Email Fix: Database Guardrails and Idempotency (Fixed)
-- Part 1: Unique constraint for one payment confirmation per order

-- Add unique partial index to enforce one payment confirmation per order
CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_events_unique_payment_confirmation 
ON communication_events (order_id) 
WHERE event_type = 'payment_confirmation' AND status != 'failed';

-- Part 2: Ensure recipient email validation trigger exists and is active
-- (Re-create if needed to ensure it's working properly)
DROP TRIGGER IF EXISTS validate_communication_event_recipient ON communication_events;

CREATE OR REPLACE FUNCTION validate_communication_event_recipient()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Normalize recipient email to lowercase
  IF NEW.recipient_email IS NOT NULL THEN
    NEW.recipient_email := LOWER(TRIM(NEW.recipient_email));
    
    -- Validate email format (basic RFC compliance)
    IF NEW.recipient_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      -- Mark as failed with clear reason instead of blocking insert
      NEW.status := 'failed';
      NEW.error_message := 'Invalid recipient email format: ' || NEW.recipient_email;
      
      -- Log security event
      INSERT INTO audit_logs (
        action, category, message, new_values
      ) VALUES (
        'invalid_email_blocked',
        'Email Security',
        'Invalid recipient email blocked: ' || NEW.recipient_email,
        jsonb_build_object(
          'event_type', NEW.event_type,
          'order_id', NEW.order_id,
          'original_email', NEW.recipient_email
        )
      );
    END IF;
  ELSE
    -- No recipient email provided
    NEW.status := 'failed';
    NEW.error_message := 'Missing recipient email';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_communication_event_recipient
  BEFORE INSERT OR UPDATE ON communication_events
  FOR EACH ROW
  EXECUTE FUNCTION validate_communication_event_recipient();

-- Part 3: Backfill and cleanup existing events
-- Update queued payment_confirmation events that are missing recipient_email
UPDATE communication_events 
SET 
  recipient_email = COALESCE(
    orders.customer_email,
    (SELECT email FROM customer_accounts WHERE id = orders.customer_id)
  ),
  updated_at = NOW()
FROM orders 
WHERE communication_events.order_id = orders.id 
  AND communication_events.event_type = 'payment_confirmation'
  AND communication_events.status IN ('queued', 'processing')
  AND (communication_events.recipient_email IS NULL OR communication_events.recipient_email = '');

-- Mark events that still don't have valid emails as failed
UPDATE communication_events 
SET 
  status = 'failed',
  error_message = 'Unable to resolve recipient email during backfill cleanup',
  updated_at = NOW()
WHERE event_type = 'payment_confirmation'
  AND status IN ('queued', 'processing')
  AND (recipient_email IS NULL OR recipient_email = '' OR recipient_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Part 4: Add monitoring helper view for admins
CREATE OR REPLACE VIEW email_monitoring_summary AS
SELECT 
  DATE(created_at) as date,
  event_type,
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as last_24h_count
FROM communication_events 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at), event_type, status
ORDER BY date DESC, event_type, status;