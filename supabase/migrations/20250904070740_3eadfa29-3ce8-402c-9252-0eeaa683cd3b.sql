-- CRITICAL FIX 4: Clear Failed Email Queue and Fix Template Keys
-- Update failed order_status_update events with proper template_key

UPDATE communication_events 
SET template_key = CASE 
    WHEN payload->>'status' = 'confirmed' THEN 'order_confirmed'
    WHEN payload->>'status' = 'preparing' THEN 'order_preparing' 
    WHEN payload->>'status' = 'ready' THEN 'order_ready'
    WHEN payload->>'status' = 'out_for_delivery' THEN 'out_for_delivery'
    WHEN payload->>'status' = 'delivered' THEN 'order_delivered'
    WHEN payload->>'status' = 'completed' THEN 'order_completed'
    ELSE 'order_confirmed'
END,
status = 'queued',
retry_count = 0,
error_message = NULL,
last_error = NULL,
updated_at = NOW()
WHERE event_type = 'order_status_update' 
  AND status = 'failed'
  AND template_key IS NULL;

-- Update payment confirmation events
UPDATE communication_events 
SET template_key = 'payment_confirmation',
    status = 'queued',
    retry_count = 0,
    error_message = NULL,
    last_error = NULL,
    updated_at = NOW()
WHERE event_type = 'payment_confirmation' 
  AND status = 'failed'
  AND template_key IS NULL;

-- Update customer welcome events  
UPDATE communication_events 
SET template_key = 'customer_welcome',
    status = 'queued',
    retry_count = 0,
    error_message = NULL,
    last_error = NULL,
    updated_at = NOW()
WHERE event_type IN ('customer_welcome', 'welcome_email')
  AND status = 'failed'
  AND template_key IS NULL;

-- Update admin notification events
UPDATE communication_events 
SET template_key = 'admin_new_order',
    status = 'queued',
    retry_count = 0,
    error_message = NULL,
    last_error = NULL,
    updated_at = NOW()
WHERE event_type = 'admin_notification'
  AND status = 'failed'
  AND template_key IS NULL;

-- Fix any remaining events without template keys
UPDATE communication_events 
SET template_key = event_type,
    status = 'queued',
    retry_count = 0,
    error_message = NULL,
    last_error = NULL,
    updated_at = NOW()
WHERE template_key IS NULL
  AND status IN ('failed', 'queued')
  AND retry_count < 3;