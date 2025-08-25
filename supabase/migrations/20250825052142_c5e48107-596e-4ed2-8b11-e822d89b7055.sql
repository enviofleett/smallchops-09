-- Clear failed email backlog and reset system
DELETE FROM communication_events WHERE status = 'failed' AND created_at < NOW() - INTERVAL '7 days';

-- Reset recent failed emails for retry
UPDATE communication_events 
SET status = 'queued', retry_count = 0, error_message = NULL
WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours';

-- Create email system health monitoring
CREATE OR REPLACE FUNCTION reset_email_system_health()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Archive old failed events
  INSERT INTO communication_events_archive
  SELECT * FROM communication_events 
  WHERE status = 'failed' AND created_at < NOW() - INTERVAL '7 days';
  
  -- Clean up old failed events
  DELETE FROM communication_events 
  WHERE status = 'failed' AND created_at < NOW() - INTERVAL '7 days';
  
  -- Reset suppression list for soft bounces
  UPDATE email_suppression_list 
  SET is_active = false 
  WHERE suppression_type = 'soft_bounce' 
  AND created_at < NOW() - INTERVAL '30 days';
  
END;
$$;