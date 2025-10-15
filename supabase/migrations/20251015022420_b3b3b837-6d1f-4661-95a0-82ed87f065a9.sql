-- Drop the problematic CHECK constraint that blocks order status updates
ALTER TABLE communication_events 
DROP CONSTRAINT IF EXISTS communication_events_valid_template_key;

-- Update queue_communication_event_nonblocking to validate templates gracefully
CREATE OR REPLACE FUNCTION queue_communication_event_nonblocking(
    p_event_type TEXT,
    p_recipient_email TEXT,
    p_template_key TEXT,
    p_template_variables JSONB,
    p_order_id UUID,
    p_priority TEXT DEFAULT 'normal'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_template_exists BOOLEAN;
    v_event_id UUID;
BEGIN
    -- Check if template exists in enhanced_email_templates
    SELECT EXISTS(
        SELECT 1 FROM enhanced_email_templates 
        WHERE template_key = p_template_key 
        AND is_active = true
    ) INTO v_template_exists;
    
    -- If template doesn't exist, log warning but don't fail
    IF NOT v_template_exists THEN
        INSERT INTO audit_logs (
            action,
            category,
            message,
            entity_id,
            new_values
        ) VALUES (
            'missing_email_template',
            'Email System',
            'Skipped email queue - template does not exist: ' || p_template_key,
            p_order_id,
            jsonb_build_object(
                'template_key', p_template_key,
                'recipient', p_recipient_email,
                'event_type', p_event_type
            )
        );
        
        RETURN jsonb_build_object(
            'success', true,
            'skipped', true,
            'reason', 'template_not_found',
            'template_key', p_template_key
        );
    END IF;
    
    -- Template exists, proceed with event creation
    INSERT INTO communication_events (
        event_type,
        recipient_email,
        template_key,
        template_variables,
        status,
        order_id,
        priority,
        created_at,
        updated_at
    ) VALUES (
        p_event_type,
        p_recipient_email,
        p_template_key,
        p_template_variables,
        'queued',
        p_order_id,
        p_priority,
        now(),
        now()
    )
    RETURNING id INTO v_event_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'event_id', v_event_id,
        'skipped', false
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Log error but return success to prevent order update failure
    INSERT INTO audit_logs (
        action,
        category,
        message,
        entity_id,
        new_values
    ) VALUES (
        'communication_event_error',
        'Email System',
        'Non-blocking error in queue_communication_event_nonblocking: ' || SQLERRM,
        p_order_id,
        jsonb_build_object(
            'error', SQLERRM,
            'template_key', p_template_key,
            'recipient', p_recipient_email
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'skipped', true,
        'reason', 'error',
        'error', SQLERRM
    );
END;
$$;