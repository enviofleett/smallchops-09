-- Phase 1: Fix Customer ID Linking System
-- Update all orders to link properly to customer_accounts using email matching

UPDATE orders 
SET customer_id = ca.id,
    updated_at = NOW()
FROM customer_accounts ca
WHERE orders.customer_email = ca.email 
  AND orders.customer_id != ca.id
  AND ca.email IS NOT NULL;

-- Also link to auth.users email if no customer account email exists
UPDATE orders 
SET customer_id = ca.id,
    updated_at = NOW()
FROM customer_accounts ca
JOIN auth.users u ON ca.user_id = u.id
WHERE orders.customer_email = u.email 
  AND orders.customer_id != ca.id
  AND ca.email IS NULL;

-- Create function to force process stuck emails
CREATE OR REPLACE FUNCTION process_stuck_emails()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  processed_count INTEGER := 0;
BEGIN
  -- Update stuck emails older than 5 minutes to trigger reprocessing
  UPDATE communication_events 
  SET status = 'queued'::communication_event_status,
      retry_count = 0,
      updated_at = NOW(),
      error_message = NULL,
      last_error = NULL
  WHERE status = 'queued'::communication_event_status
    AND created_at < NOW() - INTERVAL '5 minutes';
    
  GET DIAGNOSTICS processed_count = ROW_COUNT;
  
  -- Insert into processing queue
  INSERT INTO email_processing_queue (event_id, priority, scheduled_for, max_attempts)
  SELECT id, 
         CASE WHEN priority = 'high' THEN 'high' ELSE 'normal' END,
         NOW(),
         3
  FROM communication_events 
  WHERE status = 'queued'::communication_event_status
    AND id NOT IN (SELECT event_id FROM email_processing_queue WHERE processed_at IS NULL)
  ON CONFLICT (event_id) DO NOTHING;
  
  RETURN processed_count;
END;
$$;

-- Trigger the stuck email processing
SELECT process_stuck_emails();