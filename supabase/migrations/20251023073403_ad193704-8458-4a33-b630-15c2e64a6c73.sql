-- Enhance order status audit logging for production-ready tracking
-- Captures admin user details, order numbers, and detailed change information

CREATE OR REPLACE FUNCTION public.admin_update_order_status_bulletproof(
    p_order_id uuid, 
    p_new_status text, 
    p_admin_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_order_record RECORD;
    v_old_status TEXT;
    v_email_result JSONB;
    v_valid_statuses TEXT[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
    v_template_key TEXT;
    v_email_statuses TEXT[] := ARRAY['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
    v_admin_email TEXT;
    v_admin_name TEXT;
BEGIN
    -- Validate status
    IF p_new_status IS NULL OR p_new_status = 'null' OR p_new_status = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Status cannot be null or empty');
    END IF;

    IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid status value');
    END IF;

    -- Get admin user details for audit logging
    IF p_admin_id IS NOT NULL THEN
        SELECT 
            email,
            COALESCE(raw_user_meta_data->>'full_name', email) 
        INTO v_admin_email, v_admin_name
        FROM auth.users
        WHERE id = p_admin_id;
    END IF;

    -- Get current order with row lock
    SELECT * INTO v_order_record FROM orders WHERE id = p_order_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    v_old_status := v_order_record.status::TEXT;
    
    -- Skip if status unchanged
    IF v_old_status = p_new_status THEN
        RETURN jsonb_build_object('success', true, 'message', 'Status unchanged', 'order', row_to_json(v_order_record));
    END IF;
    
    -- Update order status
    UPDATE orders 
    SET status = p_new_status::order_status, updated_at = now(), updated_by = p_admin_id
    WHERE id = p_order_id;
    
    -- Get updated order
    SELECT * INTO v_order_record FROM orders WHERE id = p_order_id;
    
    -- Queue emails for statuses that should trigger notifications
    IF p_new_status = ANY(v_email_statuses) AND v_order_record.customer_email IS NOT NULL THEN
        -- Map status to template key
        v_template_key := CASE p_new_status
            WHEN 'confirmed' THEN 'order_confirmed'
            WHEN 'preparing' THEN 'order_preparing'
            WHEN 'ready' THEN 'order_ready'
            WHEN 'out_for_delivery' THEN 'out_for_delivery'
            WHEN 'delivered' THEN 'order_delivered'
            WHEN 'cancelled' THEN 'order_cancelled'
            ELSE NULL
        END;
        
        -- Direct insert into communication_events
        BEGIN
            INSERT INTO communication_events (
                order_id,
                event_type,
                recipient_email,
                template_key,
                status,
                variables,
                created_at,
                updated_at
            ) VALUES (
                p_order_id,
                'order_status_update',
                v_order_record.customer_email,
                v_template_key,
                'queued'::communication_event_status,
                jsonb_build_object(
                    'order_number', v_order_record.order_number,
                    'customer_name', v_order_record.customer_name,
                    'old_status', v_old_status,
                    'new_status', p_new_status
                ),
                now(),
                now()
            );
        EXCEPTION WHEN OTHERS THEN
            -- Log but don't fail the status update
            RAISE WARNING 'Failed to queue email for order %: %', p_order_id, SQLERRM;
        END;
    END IF;
    
    -- Enhanced audit log with full admin tracking and order details
    INSERT INTO audit_logs (
        action, 
        category, 
        message, 
        user_id, 
        user_name,
        entity_type,
        entity_id, 
        old_values, 
        new_values
    ) VALUES (
        'order_status_updated',
        'Order Management',
        format('Order %s: %s changed status from "%s" to "%s"', 
            v_order_record.order_number,
            COALESCE(v_admin_name, v_admin_email, 'System'),
            v_old_status,
            p_new_status
        ),
        p_admin_id,
        COALESCE(v_admin_email, 'System'),
        'order',
        p_order_id,
        jsonb_build_object(
            'status', v_old_status,
            'order_number', v_order_record.order_number,
            'customer_email', v_order_record.customer_email
        ),
        jsonb_build_object(
            'status', p_new_status,
            'order_number', v_order_record.order_number,
            'updated_by', COALESCE(v_admin_email, 'System')
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Order status updated successfully',
        'order', row_to_json(v_order_record),
        'email_queued', (p_new_status = ANY(v_email_statuses)),
        'admin', v_admin_email
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$function$;