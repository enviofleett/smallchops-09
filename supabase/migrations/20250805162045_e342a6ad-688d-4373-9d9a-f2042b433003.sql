-- Fix email processing with correct enum values
CREATE OR REPLACE FUNCTION public.process_stuck_emails()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
  processed_count INTEGER := 0;
BEGIN
  -- Reset stuck emails to trigger reprocessing
  UPDATE communication_events 
  SET status = 'queued'::communication_event_status,
      retry_count = 0,
      updated_at = NOW(),
      error_message = NULL,
      last_error = NULL
  WHERE status = 'queued'::communication_event_status
    AND created_at < NOW() - INTERVAL '2 minutes';
    
  GET DIAGNOSTICS processed_count = ROW_COUNT;
  
  -- Log the processing
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'email_stuck_processing',
    'Email System',
    'Reset ' || processed_count || ' stuck emails for reprocessing',
    jsonb_build_object('processed_count', processed_count)
  );
  
  RETURN processed_count;
END;
$$;

-- Execute stuck email processing
SELECT process_stuck_emails();