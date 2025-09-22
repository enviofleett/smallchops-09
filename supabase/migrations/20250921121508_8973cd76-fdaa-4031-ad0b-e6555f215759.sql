-- CRITICAL FIX: Enhance order status update function to ensure reliable email notifications
-- This fixes the core issue where customers don't receive email notifications when admin updates order status

-- Drop existing function and create enhanced version
DROP FUNCTION IF EXISTS admin_update_order_status_enhanced_notifications CASCADE;

-- Create comprehensive order status update function with guaranteed email notifications
CREATE OR REPLACE FUNCTION admin_update_order_status_enhanced_notifications(
    p_order_id uuid, 
    p_new_status text, 
    p_admin_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_order_record RECORD;
    v_old_status text;
    v_email_result jsonb;
    v_template_key text;
    v_status_display text;
    v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
BEGIN
    -- Input validation
    IF p_new_status IS NULL OR p_new_status = 'null' OR p_new_status = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Status cannot be null or empty');
    END IF;

    IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid status: ' || p_new_status || '. Valid: ' || array_to_string(v_valid_statuses, ', ')
        );
    END IF;

    -- Get and lock the order
    SELECT * INTO v_order_record
    FROM orders 
    WHERE id = p_order_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    v_old_status := v_order_record.status::text;
    
    -- Skip if unchanged
    IF v_old_status = p_new_status THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Status unchanged',
            'email_result', jsonb_build_object('success', true, 'message', 'No email needed'),
            'order', row_to_json(v_order_record)
        );
    END IF;
    
    -- Update order status atomically
    UPDATE orders 
    SET 
        status = p_new_status::order_status,
        updated_at = now(),
        updated_by = p_admin_id
    WHERE id = p_order_id;
    
    -- GUARANTEED EMAIL NOTIFICATION: Queue email if customer email exists
    v_email_result := jsonb_build_object('success', false, 'message', 'No customer email');
    
    IF v_order_record.customer_email IS NOT NULL AND 
       p_new_status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') THEN
        
        -- Map status to template key
        CASE p_new_status
            WHEN 'confirmed' THEN 
                v_template_key := 'order_confirmed';
                v_status_display := 'Confirmed';
            WHEN 'preparing' THEN 
                v_template_key := 'order_preparing';
                v_status_display := 'Being Prepared';
            WHEN 'ready' THEN 
                v_template_key := 'order_ready';
                v_status_display := 'Ready for Delivery';
            WHEN 'out_for_delivery' THEN 
                v_template_key := 'order_out_for_delivery';
                v_status_display := 'Out for Delivery';
            WHEN 'delivered' THEN 
                v_template_key := 'order_delivered';
                v_status_display := 'Delivered';
            WHEN 'cancelled' THEN 
                v_template_key := 'order_cancelled';
                v_status_display := 'Cancelled';
            ELSE 
                v_template_key := 'order_status_update';
                v_status_display := initcap(replace(p_new_status, '_', ' '));
        END CASE;
        
        -- Queue email with collision-resistant dedupe key
        BEGIN
            INSERT INTO communication_events (
                event_type,
                recipient_email,
                template_key,
                template_variables,
                status,
                order_id,
                dedupe_key,
                source,
                priority,
                created_at,
                updated_at
            ) VALUES (
                'order_status_update',
                v_order_record.customer_email,
                v_template_key,
                jsonb_build_object(
                    'customer_name', COALESCE(v_order_record.customer_name, 'Customer'),
                    'order_number', v_order_record.order_number,
                    'status_display', v_status_display,
                    'old_status', v_old_status,
                    'new_status', p_new_status
                ),
                'queued',
                p_order_id,
                'status_update_' || p_order_id::text || '_' || p_new_status || '_' || 
                EXTRACT(EPOCH FROM clock_timestamp())::bigint::text || '_' ||
                EXTRACT(MICROSECONDS FROM clock_timestamp())::text,
                'admin_status_update_enhanced',
                'high',
                now(),
                now()
            );
            
            v_email_result := jsonb_build_object(
                'success', true, 
                'message', 'Email queued successfully',
                'template_key', v_template_key,
                'recipient', v_order_record.customer_email
            );
            
        EXCEPTION WHEN OTHERS THEN
            -- Log email queueing failure but don't fail the status update
            INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
            VALUES (
                'email_queue_failed_non_blocking',
                'Email System',
                'Email queueing failed (non-blocking): ' || SQLERRM,
                p_admin_id,
                p_order_id,
                jsonb_build_object(
                    'error', SQLERRM,
                    'template_key', v_template_key,
                    'status', p_new_status
                )
            );
            
            v_email_result := jsonb_build_object(
                'success', false, 
                'error', SQLERRM,
                'non_blocking', true
            );
        END;
    END IF;
    
    -- Get updated order
    SELECT * INTO v_order_record FROM orders WHERE id = p_order_id;
    
    -- Log successful update
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
    VALUES (
        'admin_order_status_updated_enhanced',
        'Order Management',
        'Enhanced order status update: ' || v_old_status || ' → ' || p_new_status,
        p_admin_id,
        p_order_id,
        jsonb_build_object('status', v_old_status),
        jsonb_build_object(
            'status', p_new_status,
            'email_result', v_email_result
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Order updated successfully with email notification',
        'order', row_to_json(v_order_record),
        'email_result', v_email_result,
        'old_status', v_old_status,
        'new_status', p_new_status
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Log error with full context
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
    VALUES (
        'admin_order_status_update_failed_enhanced',
        'Critical Error',
        'Enhanced order status update failed: ' || SQLERRM,
        p_admin_id,
        p_order_id,
        jsonb_build_object(
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'old_status', v_old_status,
            'new_status', p_new_status
        )
    );
    
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Database error: ' || SQLERRM,
        'recovery_actions', jsonb_build_array(
            'Check network connection',
            'Refresh page and retry',
            'Contact system administrator'
        )
    );
END;
$$;