-- Fix security warnings for new functions
-- Add SET search_path TO 'public' to all new functions

-- Fix generate_atomic_dedupe_key function
CREATE OR REPLACE FUNCTION generate_atomic_dedupe_key(
    p_order_id uuid,
    p_event_type text,
    p_template_key text,
    p_recipient_email text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_session_id text;
    v_sequence bigint;
    v_timestamp bigint;
BEGIN
    -- Get atomic values
    v_sequence := nextval('communication_event_sequence');
    v_timestamp := extract(epoch from clock_timestamp())::bigint;
    v_session_id := pg_backend_pid()::text;
    
    -- Create collision-resistant dedupe key
    RETURN concat(
        COALESCE(p_order_id::text, 'no-order'),
        '|',
        p_event_type,
        '|',
        COALESCE(p_template_key, 'no-template'),
        '|',
        p_recipient_email,
        '|',
        v_timestamp,
        '|',
        v_session_id,
        '|',
        v_sequence
    );
END;
$$;

-- Fix cleanup_old_communication_events function  
CREATE OR REPLACE FUNCTION cleanup_old_communication_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_deleted_count integer;
BEGIN
    -- Archive events older than 30 days
    INSERT INTO communication_events_archive
    SELECT * FROM communication_events
    WHERE created_at < now() - interval '30 days'
    AND status IN ('sent', 'failed');
    
    -- Delete archived events
    DELETE FROM communication_events
    WHERE created_at < now() - interval '30 days'
    AND status IN ('sent', 'failed');
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$;