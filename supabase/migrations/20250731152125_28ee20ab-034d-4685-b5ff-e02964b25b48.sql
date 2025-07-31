-- Test the email system by manually processing any existing queued events
-- First, let's see what communication events exist
SELECT 
  id, 
  event_type, 
  recipient_email, 
  status, 
  created_at,
  error_message
FROM public.communication_events 
WHERE event_type = 'customer_welcome'
ORDER BY created_at DESC 
LIMIT 10;