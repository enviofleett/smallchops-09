-- Create function for idempotent payment confirmation event insertion
CREATE OR REPLACE FUNCTION public.upsert_payment_confirmation_event(
  p_reference TEXT,
  p_recipient_email TEXT,
  p_order_id UUID DEFAULT NULL,
  p_template_variables JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id UUID;
  v_existing_event RECORD;
  v_result JSONB;
BEGIN
  -- Input validation
  IF p_reference IS NULL OR LENGTH(TRIM(p_reference)) = 0 THEN
    RAISE EXCEPTION 'Payment reference cannot be null or empty';
  END IF;
  
  IF p_recipient_email IS NULL OR LENGTH(TRIM(p_recipient_email)) = 0 THEN
    RAISE EXCEPTION 'Recipient email cannot be null or empty';
  END IF;
  
  -- Check for existing payment confirmation event
  SELECT * INTO v_existing_event
  FROM communication_events
  WHERE event_type = 'payment_confirmation'
    AND (payload->>'reference' = p_reference OR payload->>'payment_reference' = p_reference)
    AND recipient_email = LOWER(TRIM(p_recipient_email))
  LIMIT 1;
  
  IF FOUND THEN
    -- Return existing event info
    v_result := jsonb_build_object(
      'success', true,
      'event_id', v_existing_event.id,
      'status', 'duplicate_handled',
      'message', 'Payment confirmation event already exists',
      'existing', true
    );
    
    RETURN v_result;
  END IF;
  
  -- Insert new payment confirmation event
  INSERT INTO communication_events (
    event_type,
    recipient_email,
    order_id,
    payload,
    template_variables,
    status,
    priority,
    created_at,
    scheduled_at
  ) VALUES (
    'payment_confirmation',
    LOWER(TRIM(p_recipient_email)),
    p_order_id,
    jsonb_build_object(
      'reference', p_reference,
      'payment_reference', p_reference,
      'confirmation_type', 'payment_success'
    ),
    p_template_variables,
    'queued',
    'high',
    NOW(),
    NOW()
  ) RETURNING id INTO v_event_id;
  
  v_result := jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'status', 'created',
    'message', 'Payment confirmation event created successfully',
    'existing', false
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN unique_violation THEN
    -- Handle race condition - another process inserted the same event
    SELECT * INTO v_existing_event
    FROM communication_events
    WHERE event_type = 'payment_confirmation'
      AND (payload->>'reference' = p_reference OR payload->>'payment_reference' = p_reference)
      AND recipient_email = LOWER(TRIM(p_recipient_email))
    LIMIT 1;
    
    IF FOUND THEN
      v_result := jsonb_build_object(
        'success', true,
        'event_id', v_existing_event.id,
        'status', 'race_condition_handled',
        'message', 'Payment confirmation event created by concurrent process',
        'existing', true
      );
      
      RETURN v_result;
    ELSE
      -- Re-raise if it's a different unique violation
      RAISE;
    END IF;
  WHEN OTHERS THEN
    -- Log and re-raise other errors
    RAISE EXCEPTION 'Failed to create payment confirmation event: %', SQLERRM;
END;
$$;