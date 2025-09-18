-- Fix security warning: Add search_path to function
CREATE OR REPLACE FUNCTION generate_dedupe_key_safe(
  p_order_id TEXT,
  p_event_type TEXT,
  p_template_key TEXT,
  p_recipient_identifier TEXT
) RETURNS TEXT LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  epoch bigint;
  micros text;
BEGIN
  epoch := EXTRACT(EPOCH FROM clock_timestamp())::bigint;
  micros := (EXTRACT(MICROSECONDS FROM clock_timestamp()))::text;
  RETURN concat_ws('|', coalesce(p_order_id,''), coalesce(p_event_type,''), coalesce(p_template_key,''), coalesce(p_recipient_identifier,''), epoch::text, micros, gen_random_uuid()::text);
END;
$$;