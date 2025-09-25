-- Reset failed communication events to queued status for reprocessing
UPDATE communication_events 
SET 
  status = 'queued', 
  retry_count = 0, 
  last_error = NULL,
  error_message = NULL,
  updated_at = now()
WHERE status = 'failed' 
  AND event_type = 'order_status_update';