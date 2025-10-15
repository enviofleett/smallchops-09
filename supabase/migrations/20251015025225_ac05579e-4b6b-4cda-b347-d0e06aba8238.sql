-- Drop the old version of queue_communication_event_nonblocking with incorrect parameter order
DROP FUNCTION IF EXISTS public.queue_communication_event_nonblocking(uuid, text, text, text, jsonb);

-- Verify only the correct version remains with signature:
-- queue_communication_event_nonblocking(p_event_type text, p_recipient_email text, p_template_key text, p_template_variables jsonb, p_order_id uuid, p_priority text)
