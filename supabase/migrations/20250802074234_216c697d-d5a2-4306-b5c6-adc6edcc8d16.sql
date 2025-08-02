-- EMERGENCY FIX: Remove problematic trigger and replace with working solution
-- This fixes the "schema net does not exist" error

-- Drop the problematic trigger and function that uses net.http_post()
DROP TRIGGER IF EXISTS trigger_instant_email_processing ON communication_events;
DROP FUNCTION IF EXISTS trigger_email_processing();

-- Create a simpler trigger function that doesn't use net schema
CREATE OR REPLACE FUNCTION trigger_email_processing()
RETURNS TRIGGER AS $$
BEGIN
  -- Simple trigger that just logs the event without HTTP calls
  -- The instant-email-processor function will handle the actual processing
  INSERT INTO audit_logs (
    action, 
    category, 
    message, 
    new_values
  ) VALUES (
    'email_queued', 
    'Communication', 
    'Email event queued for processing: ' || NEW.event_type,
    jsonb_build_object(
      'event_id', NEW.id,
      'event_type', NEW.event_type,
      'recipient_email', NEW.recipient_email,
      'status', NEW.status
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger (without HTTP calls)
CREATE TRIGGER trigger_instant_email_processing
  AFTER INSERT ON communication_events
  FOR EACH ROW
  WHEN (NEW.status = 'queued' AND NEW.event_type = 'customer_welcome')
  EXECUTE FUNCTION trigger_email_processing();

-- Reset any failed emails to queued for reprocessing
UPDATE communication_events 
SET status = 'queued', retry_count = 0, error_message = NULL
WHERE status = 'failed' AND event_type = 'customer_welcome';

-- Log the emergency fix
INSERT INTO audit_logs (action, category, message) 
VALUES ('emergency_fix_applied', 'System Maintenance', 'Fixed net schema error - replaced HTTP trigger with logging trigger');