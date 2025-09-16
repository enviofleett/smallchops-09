
-- Make upserts idempotent based on the actual unique index:
-- idx_communication_events_unique_payment_confirmation (order_id) WHERE event_type='payment_confirmation' AND status <> 'failed'

-- 1) Overload returning JSONB (keeps signature and behavior)
CREATE OR REPLACE FUNCTION public.upsert_payment_confirmation_event(
  p_reference TEXT,
  p_recipient_email TEXT,
  p_order_id UUID DEFAULT NULL,
  p_template_variables JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id UUID;
  v_existing JSONB;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id is required';
  END IF;

  IF p_reference IS NULL OR length(trim(p_reference)) = 0 THEN
    RAISE EXCEPTION 'Payment reference cannot be null or empty';
  END IF;

  IF p_recipient_email IS NULL OR length(trim(p_recipient_email)) = 0 THEN
    RAISE EXCEPTION 'Recipient email cannot be null or empty';
  END IF;

  -- Single canonical upsert aligned with the unique index (order_id)
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
    scheduled_at,
    updated_at
  ) VALUES (
    'payment_confirmation',
    LOWER(TRIM(p_recipient_email)),
    p_order_id,
    'queued',
    'high',
    'payment_confirmation',
    COALESCE(p_template_variables, '{}'::jsonb),
    jsonb_build_object('reference', p_reference, 'payment_reference', p_reference),
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (order_id) DO UPDATE
  SET
    -- do not change status; keep existing status (sent/processing etc.)
    recipient_email = COALESCE(communication_events.recipient_email, EXCLUDED.recipient_email),
    template_variables = COALESCE(communication_events.template_variables, '{}'::jsonb) || COALESCE(EXCLUDED.template_variables, '{}'::jsonb),
    payload = COALESCE(communication_events.payload, '{}'::jsonb) || COALESCE(EXCLUDED.payload, '{}'::jsonb),
    updated_at = NOW()
  WHERE communication_events.event_type = 'payment_confirmation'
    AND communication_events.status <> 'failed'
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'status', 'upserted',
    'message', 'Payment confirmation event upserted successfully',
    'existing', false
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Defensive fallback: fetch by order_id only (aligned with unique index)
    SELECT jsonb_build_object(
      'success', true,
      'event_id', id,
      'status', 'duplicate_handled',
      'message', 'Payment confirmation event already exists (by order_id)',
      'existing', true
    )
    INTO v_existing
    FROM communication_events
    WHERE event_type = 'payment_confirmation'
      AND status <> 'failed'
      AND order_id = p_order_id
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;

    -- If we didn’t find it, re-raise so callers can see the true error
    RAISE;

  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'code', SQLSTATE
    );
END;
$function$;

-- 2) Overload returning UUID (keeps signature and behavior)
CREATE OR REPLACE FUNCTION public.upsert_payment_confirmation_event(
  p_reference TEXT,
  p_order_id UUID,
  p_recipient_email TEXT,
  p_template_variables JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id UUID;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id is required';
  END IF;

  IF p_reference IS NULL OR length(trim(p_reference)) = 0 THEN
    RAISE EXCEPTION 'Payment reference cannot be null or empty';
  END IF;

  IF p_recipient_email IS NULL OR length(trim(p_recipient_email)) = 0 THEN
    RAISE EXCEPTION 'Recipient email cannot be null or empty';
  END IF;

  -- Canonical ON CONFLICT upsert keyed by order_id
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
    scheduled_at,
    updated_at
  ) VALUES (
    'payment_confirmation',
    LOWER(TRIM(p_recipient_email)),
    p_order_id,
    'queued',
    'high',
    'payment_confirmation',
    COALESCE(p_template_variables, '{}'::jsonb),
    jsonb_build_object('reference', p_reference, 'payment_reference', p_reference),
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (order_id) DO UPDATE
  SET
    recipient_email = COALESCE(communication_events.recipient_email, EXCLUDED.recipient_email),
    template_variables = COALESCE(communication_events.template_variables, '{}'::jsonb) || COALESCE(EXCLUDED.template_variables, '{}'::jsonb),
    payload = COALESCE(communication_events.payload, '{}'::jsonb) || COALESCE(EXCLUDED.payload, '{}'::jsonb),
    updated_at = NOW()
  WHERE communication_events.event_type = 'payment_confirmation'
    AND communication_events.status <> 'failed'
  RETURNING id INTO v_event_id;

  RETURN v_event_id;

EXCEPTION
  WHEN unique_violation THEN
    -- Return the existing event id by order_id (aligned with unique index)
    SELECT id INTO v_event_id
    FROM communication_events
    WHERE event_type = 'payment_confirmation'
      AND status <> 'failed'
      AND order_id = p_order_id
    LIMIT 1;

    IF v_event_id IS NOT NULL THEN
      RETURN v_event_id;
    END IF;

    RAISE;
END;
$function$;
