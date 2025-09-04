
-- 1) Drop conflicting overloads to eliminate ambiguity
-- Overload with argument order (text, uuid, text, jsonb)
DROP FUNCTION IF EXISTS public.upsert_payment_confirmation_event(text, uuid, text, jsonb);

-- Overload with only 3 args (uuid, text, text)
DROP FUNCTION IF EXISTS public.upsert_payment_confirmation_event(uuid, text, text);

-- 2) Create a single canonical JSONB-returning function that matches callers
CREATE OR REPLACE FUNCTION public.upsert_payment_confirmation_event(
  p_reference         text,
  p_recipient_email   text,
  p_order_id          uuid,
  p_template_variables jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
  v_existing_id uuid;
BEGIN
  -- Validate inputs
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id is required';
  END IF;

  IF p_reference IS NULL OR length(trim(p_reference)) = 0 THEN
    RAISE EXCEPTION 'Payment reference cannot be null or empty';
  END IF;

  IF p_recipient_email IS NULL OR length(trim(p_recipient_email)) = 0 THEN
    RAISE EXCEPTION 'Recipient email cannot be null or empty';
  END IF;

  -- Idempotency: if an event already exists for this order_id and event_type, return it
  SELECT id
  INTO v_existing_id
  FROM communication_events
  WHERE event_type = 'payment_confirmation'
    AND order_id = p_order_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'event_id', v_existing_id,
      'status', 'duplicate_handled',
      'message', 'Payment confirmation event already exists',
      'existing', true
    );
  END IF;

  -- Insert new event
  INSERT INTO communication_events (
    event_type,
    recipient_email,
    order_id,
    payload,
    template_variables,
    status,
    priority,
    template_key,
    created_at,
    scheduled_at
  ) VALUES (
    'payment_confirmation',
    LOWER(TRIM(p_recipient_email)),
    p_order_id,
    jsonb_build_object(
      'reference', p_reference,
      'payment_reference', p_reference,
      'order_id', p_order_id
    ),
    COALESCE(p_template_variables, '{}'::jsonb),
    'queued',
    'high',
    'payment_confirmation',
    NOW(),
    NOW()
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'status', 'created',
    'message', 'Payment confirmation event created successfully',
    'existing', false
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Handle race condition: another process inserted the same record
    SELECT id INTO v_existing_id
    FROM communication_events
    WHERE event_type = 'payment_confirmation'
      AND order_id = p_order_id
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'event_id', v_existing_id,
        'status', 'race_condition_handled',
        'message', 'Payment confirmation event created by concurrent process',
        'existing', true
      );
    ELSE
      RAISE;
    END IF;

  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', SQLERRM,
      'code', SQLSTATE
    );
END;
$function$;
