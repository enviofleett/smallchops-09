-- Create idempotent payment confirmation event function
CREATE OR REPLACE FUNCTION public.upsert_payment_confirmation_event(
  p_reference TEXT,
  p_order_id UUID,
  p_recipient_email TEXT,
  p_template_variables JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id UUID;
  v_existing_event_id UUID;
BEGIN
  -- Validate inputs
  IF p_reference IS NULL OR LENGTH(TRIM(p_reference)) = 0 THEN
    RAISE EXCEPTION 'Payment reference cannot be null or empty';
  END IF;
  
  IF p_recipient_email IS NULL OR LENGTH(TRIM(p_recipient_email)) = 0 THEN
    RAISE EXCEPTION 'Recipient email cannot be null or empty';
  END IF;

  -- Basic email validation
  IF p_recipient_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format: %', p_recipient_email;
  END IF;

  -- Check if payment confirmation event already exists
  SELECT id INTO v_existing_event_id
  FROM communication_events
  WHERE event_type = 'payment_confirmation'
    AND payload->>'reference' = p_reference
    AND order_id = p_order_id
  LIMIT 1;

  IF v_existing_event_id IS NOT NULL THEN
    -- Event already exists, return existing ID
    RETURN v_existing_event_id;
  END IF;

  -- Insert new payment confirmation event
  INSERT INTO communication_events (
    event_type,
    recipient_email,
    order_id,
    status,
    priority,
    template_key,
    template_variables,
    payload,
    created_at,
    scheduled_at
  ) VALUES (
    'payment_confirmation',
    LOWER(TRIM(p_recipient_email)),
    p_order_id,
    'queued',
    'high',
    'payment_confirmation',
    p_template_variables,
    jsonb_build_object(
      'reference', p_reference,
      'order_id', p_order_id,
      'confirmation_type', 'payment_success'
    ),
    NOW(),
    NOW()
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;

EXCEPTION
  WHEN unique_violation THEN
    -- Handle race condition - another process inserted the same record
    SELECT id INTO v_existing_event_id
    FROM communication_events
    WHERE event_type = 'payment_confirmation'
      AND payload->>'reference' = p_reference
      AND order_id = p_order_id
    LIMIT 1;
    
    IF v_existing_event_id IS NOT NULL THEN
      RETURN v_existing_event_id;
    ELSE
      -- Re-raise if we can't find the conflicting record
      RAISE;
    END IF;
END;
$function$;