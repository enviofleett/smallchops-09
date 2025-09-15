-- Update admin_queue_order_email to use UPSERT with timestamp update instead of DO NOTHING
CREATE OR REPLACE FUNCTION public.admin_queue_order_email(p_order_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    customer_email TEXT;
    customer_name TEXT;
    template_key TEXT;
    unique_key TEXT;
    order_number TEXT;
    total_amount NUMERIC;
BEGIN
    -- Get order and customer info
    SELECT o.order_number, o.total_amount, o.customer_email, o.customer_name
    INTO order_number, total_amount, customer_email, customer_name
    FROM orders o
    WHERE o.id = p_order_id;
    
    -- Skip if no customer email
    IF customer_email IS NULL THEN
        RETURN;
    END IF;
    
    -- Get template key
    CASE p_status
        WHEN 'confirmed' THEN template_key := 'order_confirmed';
        WHEN 'preparing' THEN template_key := 'order_preparing';
        WHEN 'ready' THEN template_key := 'order_ready';
        WHEN 'out_for_delivery' THEN template_key := 'order_out_for_delivery';
        WHEN 'delivered' THEN template_key := 'order_delivered';
        WHEN 'cancelled' THEN template_key := 'order_cancelled';
        ELSE RETURN;
    END CASE;
    
    -- Create truly unique key with timestamp
    unique_key := p_order_id::TEXT || '|' || 
                 p_status || '|' || 
                 template_key || '|' || 
                 customer_email || '|' || 
                 FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000000)::TEXT;
    
    -- Use UPSERT: Insert or update updated_at if duplicate dedupe_key found
    INSERT INTO communication_events (
        event_type,
        recipient_email,
        template_key,
        template_variables,
        status,
        dedupe_key,
        order_id,
        created_at,
        updated_at
    ) VALUES (
        'order_status_update',
        customer_email,
        template_key,
        jsonb_build_object(
            'customer_name', COALESCE(customer_name, 'Customer'),
            'order_number', order_number,
            'status', p_status,
            'total_amount', COALESCE(total_amount, 0)
        ),
        'queued',
        unique_key,
        p_order_id,
        now(),
        now()
    ) ON CONFLICT (dedupe_key) DO UPDATE SET
        updated_at = now(),
        status = CASE 
            WHEN communication_events.status = 'failed' THEN 'queued'
            ELSE communication_events.status
        END;
    
    -- Log successful upsert
    INSERT INTO audit_logs (action, category, message, entity_id, new_values)
    VALUES (
        'communication_event_upserted',
        'Email System',
        'Communication event upserted for order: ' || order_number,
        p_order_id,
        jsonb_build_object(
            'dedupe_key', unique_key,
            'template_key', template_key,
            'status', p_status,
            'upsert_type', 'admin_queue_order_email'
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Enhanced error logging
    INSERT INTO audit_logs (action, category, message, entity_id, new_values)
    VALUES (
        'communication_event_upsert_failed',
        'Email System',
        'Failed to upsert communication event: ' || SQLERRM,
        p_order_id,
        jsonb_build_object(
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'order_id', p_order_id,
            'status', p_status,
            'template_key', template_key
        )
    );
    
    -- Log error but don't propagate
    RAISE LOG 'Failed to queue email for order %: %', p_order_id, SQLERRM;
END;
$function$