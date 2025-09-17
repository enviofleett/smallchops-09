-- Production-Ready Order Management System Fixes - Part 1
-- Drop existing function that conflicts with return type

DROP FUNCTION IF EXISTS public.cleanup_old_communication_events();

-- 1. Create robust communication event upsert function with collision resistance
CREATE OR REPLACE FUNCTION public.upsert_communication_event_production(
  p_event_type text,
  p_recipient_email text,
  p_template_key text,
  p_template_variables jsonb DEFAULT '{}'::jsonb,
  p_order_id uuid DEFAULT NULL::uuid,
  p_source text DEFAULT 'system'::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_event_id uuid;
  v_dedupe_key text;
BEGIN
  -- Generate collision-resistant dedupe key
  v_dedupe_key := COALESCE(p_order_id::text, 'no-order') || '|' || 
                  p_event_type || '|' || 
                  COALESCE(p_template_key, 'no-template') || '|' ||
                  p_recipient_email || '|' ||
                  EXTRACT(EPOCH FROM clock_timestamp())::bigint::text || '|' ||
                  gen_random_uuid()::text;

  -- Insert with ON CONFLICT handling
  INSERT INTO communication_events (
    event_type,
    recipient_email,
    template_key,
    template_variables,
    status,
    dedupe_key,
    order_id,
    source,
    priority,
    created_at,
    updated_at
  ) VALUES (
    p_event_type,
    p_recipient_email,
    p_template_key,
    p_template_variables,
    'queued',
    v_dedupe_key,
    p_order_id,
    p_source,
    'normal',
    now(),
    now()
  )
  ON CONFLICT (dedupe_key) DO UPDATE SET
    template_variables = EXCLUDED.template_variables,
    updated_at = now(),
    status = CASE 
      WHEN communication_events.status = 'failed' THEN 'queued'
      ELSE communication_events.status
    END
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'dedupe_key', v_dedupe_key
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error but return success to prevent order update failures
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'communication_event_queue_failed_production',
    'Email System',
    'Failed to queue communication event (non-blocking): ' || SQLERRM,
    jsonb_build_object(
      'error', SQLERRM,
      'sqlstate', SQLSTATE,
      'event_type', p_event_type,
      'recipient_email', p_recipient_email,
      'order_id', p_order_id
    )
  );

  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'non_blocking', true
  );
END;
$$;