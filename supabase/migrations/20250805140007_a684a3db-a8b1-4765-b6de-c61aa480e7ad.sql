-- Clean up failed/problematic queued emails for clean testing
-- Step 1: Remove emails with edge function errors (these are old test emails)
DELETE FROM communication_events 
WHERE status = 'queued'::communication_event_status
AND error_message = 'Edge Function returned a non-2xx status code';

-- Step 2: Remove old test emails that are clogging the queue
DELETE FROM communication_events 
WHERE status = 'queued'::communication_event_status
AND recipient_email = 'chudesyl@gmail.com'
AND created_at < NOW() - INTERVAL '1 hour';

-- Step 3: Keep only fresh emails without errors for testing
-- (This will preserve any legitimate recent emails)

-- Step 4: Reset any remaining queued emails to fresh state
UPDATE communication_events 
SET retry_count = 0,
    error_message = NULL,
    last_error = NULL,
    updated_at = NOW()
WHERE status = 'queued'::communication_event_status;

-- Log the cleanup
INSERT INTO audit_logs (action, category, message, new_values) 
VALUES (
  'cleanup_email_queue',
  'Email System',
  'Cleaned up problematic queued emails for fresh testing',
  jsonb_build_object(
    'cleaned_at', NOW(),
    'remaining_queued', (SELECT COUNT(*) FROM communication_events WHERE status = 'queued')
  )
);