-- Create optional fallback function for communication events insertion
-- This provides additional safety for extremely rare collision cases
CREATE OR REPLACE FUNCTION public.insert_comm_event_on_conflict_do_nothing(event_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    event_id uuid;
BEGIN
    -- Try to insert, ignore conflicts completely
    INSERT INTO communication_events (
        dedupe_key,
        event_type, 
        channel,
        recipient_email,
        sms_phone,
        order_id,
        status,
        template_key,
        template_variables,
        source,
        priority,
        created_at,
        updated_at
    ) VALUES (
        event_data->>'dedupe_key',
        event_data->>'event_type',
        event_data->>'channel', 
        event_data->>'recipient_email',
        event_data->>'sms_phone',
        (event_data->>'order_id')::uuid,
        event_data->>'status',
        event_data->>'template_key',
        (event_data->>'template_variables')::jsonb,
        event_data->>'source',
        event_data->>'priority',
        (event_data->>'created_at')::timestamp with time zone,
        (event_data->>'updated_at')::timestamp with time zone
    )
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING id INTO event_id;
    
    -- Return the ID if inserted, or NULL if conflict occurred
    RETURN event_id;
    
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't throw - return NULL to indicate failure
    INSERT INTO audit_logs (action, category, message, new_values)
    VALUES (
        'communication_event_fallback_insert_failed',
        'Email System',
        'Fallback insert failed (non-critical): ' || SQLERRM,
        jsonb_build_object('error', SQLERRM, 'event_data', event_data)
    );
    
    RETURN NULL;
END;
$$;