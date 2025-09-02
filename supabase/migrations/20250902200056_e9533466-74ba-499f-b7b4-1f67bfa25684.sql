-- Create partial unique index for payment confirmation idempotency using order_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_events_unique_payment_confirmation 
ON communication_events (event_type, order_id) 
WHERE event_type = 'payment_confirmation';

-- Update the upsert function to work with order_id instead of reference
CREATE OR REPLACE FUNCTION public.upsert_payment_confirmation_event(
  p_reference text,
  p_recipient_email text,
  p_order_id uuid,
  p_template_variables jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id UUID;
  v_existing RECORD;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id is required for payment confirmation events';
  END IF;

  -- Try to insert, handle duplicate gracefully using order_id uniqueness
  BEGIN
    INSERT INTO communication_events (
      event_type,
      recipient_email,
      order_id,
      template_variables,
      status,
      created_at,
      external_id
    )
    VALUES (
      'payment_confirmation',
      p_recipient_email,
      p_order_id,
      p_template_variables,
      'pending',
      NOW(),
      p_reference -- Store reference in external_id field
    )
    RETURNING id INTO v_event_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Payment confirmation event created',
      'event_id', v_event_id,
      'action', 'created'
    );
    
  EXCEPTION WHEN unique_violation THEN
    -- Handle duplicate - find existing and return success
    SELECT id, status INTO v_existing
    FROM communication_events
    WHERE event_type = 'payment_confirmation' 
      AND order_id = p_order_id
    LIMIT 1;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Payment confirmation event already exists - idempotent success',
      'event_id', v_existing.id,
      'action', 'exists',
      'status', v_existing.status
    );
  END;
END;
$$;