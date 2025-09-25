-- Phase 2: Production Hardening - Migration 06: Duplicate Violation Audit Trigger
-- Trigger logs attempt metadata when duplicate conflicts happen
CREATE OR REPLACE FUNCTION log_duplicate_attempt() RETURNS trigger LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert a lightweight record to audit_logs for observability
  INSERT INTO audit_logs(action, category, message, new_values, event_time)
  VALUES (
    'duplicate_dedupe_key_attempt',
    'communication_events',
    'Attempted to create duplicate communication_event',
    jsonb_build_object('dedupe_key', NEW.dedupe_key, 'event_type', NEW.event_type, 'recipient', COALESCE(NEW.recipient_email, NEW.sms_phone), 'order_id', NEW.order_id),
    NOW()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Avoid breaking main flow
  RETURN NEW;
END;
$$;

-- Note: Trigger can be optionally attached to BEFORE INSERT for comprehensive logging
-- CREATE TRIGGER log_duplicate_attempt_trg BEFORE INSERT ON communication_events FOR EACH ROW EXECUTE FUNCTION log_duplicate_attempt();