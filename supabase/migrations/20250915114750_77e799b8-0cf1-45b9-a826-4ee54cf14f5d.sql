-- Improve upsert_communication_event function to handle duplicates more gracefully
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
 SET search_path TO 'public'
AS $function$
DECLARE
    event_id UUID;
    calculated_dedupe_key TEXT;
    unique_suffix TEXT;
    attempt_count INTEGER := 0;
    max_attempts INTEGER := 5;
BEGIN
    -- Generate truly unique dedupe key with multiple layers of uniqueness
    LOOP
        attempt_count := attempt_count + 1;
        
        IF p_dedupe_key IS NULL THEN
            -- Generate completely unique key using UUID + timestamp + random
            unique_suffix := gen_random_uuid()::text || '_' || 
                           EXTRACT(EPOCH FROM clock_timestamp())::bigint::text || '_' ||
                           EXTRACT(MICROSECONDS FROM clock_timestamp())::text;
            calculated_dedupe_key := p_related_order_id::TEXT || '|' || 
                                   p_event_type || '|' || 
                                   COALESCE(p_template_key, 'no-template') || '|' || 
                                   p_recipient_email || '|' || 
                                   unique_suffix;
        ELSE
            -- Use provided key but ensure uniqueness
            unique_suffix := gen_random_uuid()::text || '_' || 
                           EXTRACT(EPOCH FROM clock_timestamp())::bigint::text || '_' ||
                           EXTRACT(MICROSECONDS FROM clock_timestamp())::text;
            calculated_dedupe_key := p_dedupe_key || '|' || unique_suffix;
        END IF;
        
        -- Try to insert with generated dedupe key
        BEGIN
            INSERT INTO communication_events (
                event_type, recipient_email, template_key, template_variables,
                status, dedupe_key, order_id, created_at, updated_at
            ) VALUES (
                p_event_type, p_recipient_email, p_template_key, p_template_variables,
                'queued', calculated_dedupe_key, p_related_order_id, now(), now()
            )
            RETURNING id INTO event_id;
            
            -- If successful, exit the loop
            EXIT;
            
        EXCEPTION
            WHEN unique_violation THEN
                -- Log the collision and retry with new suffix
                INSERT INTO audit_logs (action, category, message, new_values)
                VALUES (
                    'communication_event_dedupe_collision',
                    'Email System',
                    'Dedupe key collision on attempt ' || attempt_count::text,
                    jsonb_build_object(
                        'attempted_key', calculated_dedupe_key,
                        'order_id', p_related_order_id,
                        'event_type', p_event_type,
                        'attempt', attempt_count
                    )
                );
                
                -- If max attempts reached, try ON CONFLICT approach
                IF attempt_count >= max_attempts THEN
                    -- Final attempt with ON CONFLICT DO UPDATE
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
                    
                    EXIT;
                END IF;
                
                -- Continue loop for retry
        END;
    END LOOP;
    
    -- Log successful creation
    INSERT INTO audit_logs (action, category, message, new_values)
    VALUES (
        'communication_event_created',
        'Email System',
        'Communication event created successfully',
        jsonb_build_object(
            'event_id', event_id,
            'event_type', p_event_type,
            'order_id', p_related_order_id,
            'dedupe_key', calculated_dedupe_key,
            'attempts', attempt_count
        )
    );
    
    RETURN event_id;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail - return NULL to indicate failure
        INSERT INTO audit_logs (action, category, message, new_values)
        VALUES (
            'communication_event_creation_failed',
            'Email System',
            'Failed to create communication event: ' || SQLERRM,
            jsonb_build_object(
                'event_type', p_event_type,
                'order_id', p_related_order_id,
                'error', SQLERRM,
                'sqlstate', SQLSTATE
            )
        );
        
        -- Return NULL instead of raising exception
        RETURN NULL;
END;
$function$;