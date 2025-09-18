-- Phase 1: Core Functions - Migration 04: Atomic Upsert Function
-- This function performs a safe insert/upsert for communication_events atomically
CREATE OR REPLACE FUNCTION create_communication_event(
  p_dedupe_key TEXT,
  p_event_type TEXT,
  p_template_key TEXT,
  p_recipient_email TEXT,
  p_sms_phone TEXT,
  p_channel TEXT,
  p_order_id UUID,
  p_status TEXT DEFAULT 'queued',
  p_payload JSONB DEFAULT '{}'::jsonb
) RETURNS VOID LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO communication_events (
    dedupe_key, event_type, template_key, recipient_email, sms_phone, channel,
    order_id, status, payload, created_at, updated_at
  ) VALUES (
    p_dedupe_key, p_event_type, p_template_key, p_recipient_email, p_sms_phone, p_channel,
    p_order_id, p_status, p_payload, NOW(), NOW()
  )
  ON CONFLICT (dedupe_key) DO UPDATE
  SET
    updated_at = NOW(),
    -- If existing status is 'failed' we re-queue it, otherwise preserve existing status
    status = CASE WHEN communication_events.status = 'failed' THEN 'queued' ELSE communication_events.status END,
    payload = COALESCE(EXCLUDED.payload, communication_events.payload);
EXCEPTION WHEN unique_violation THEN
  -- Defensive: update timestamps if a race occurs
  UPDATE communication_events
  SET updated_at = NOW()
  WHERE dedupe_key = p_dedupe_key;
END;
$$;