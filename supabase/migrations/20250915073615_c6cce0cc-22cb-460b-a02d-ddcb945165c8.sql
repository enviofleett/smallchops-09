-- Apply enhanced UPSERT function with better uniqueness
CREATE OR REPLACE FUNCTION public.upsert_communication_event(
    p_event_type text, 
    p_recipient_email text, 
    p_recipient_name text, 
    p_template_key text, 
    p_template_variables jsonb, 
    p_related_order_id uuid, 
    p_dedupe_key text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    event_id UUID;
    calculated_dedupe_key TEXT;
    random_suffix TEXT;
BEGIN
    -- Generate unique dedupe key with enhanced randomness
    IF p_dedupe_key IS NULL THEN
        random_suffix := substring(gen_random_uuid()::text from 1 for 8);
        calculated_dedupe_key := p_related_order_id::TEXT || '|' || 
                               p_event_type || '|' || 
                               COALESCE(p_template_key, 'no-template') || '|' || 
                               p_recipient_email || '|' || 
                               EXTRACT(EPOCH FROM clock_timestamp())::TEXT || '|' ||
                               random_suffix;
    ELSE
        calculated_dedupe_key := p_dedupe_key || '|' || EXTRACT(EPOCH FROM clock_timestamp())::TEXT;
    END IF;
    
    -- Insert with ON CONFLICT handling
    INSERT INTO communication_events (
        event_type, recipient_email, template_key, template_variables,
        status, dedupe_key, order_id, created_at, updated_at
    ) VALUES (
        p_event_type, p_recipient_email, p_template_key, p_template_variables,
        'queued', calculated_dedupe_key, p_related_order_id, now(), now()
    )
    ON CONFLICT (dedupe_key) DO UPDATE SET
        template_variables = EXCLUDED.template_variables,
        updated_at = now(),
        status = CASE 
            WHEN communication_events.status = 'failed' THEN 'queued'
            ELSE communication_events.status
        END
    RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$function$