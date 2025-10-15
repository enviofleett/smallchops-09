-- ================================================
-- RESTORE TO 3:40AM WORKING STATE
-- This reverts all the constraint and function changes
-- ================================================

-- 1. Drop the unique constraint on dedupe_key (wasn't present at 3:40am)
DROP INDEX IF EXISTS idx_communication_events_dedupe_key;

-- 2. Make template_key nullable (as it was at 3:40am)
ALTER TABLE communication_events 
ALTER COLUMN template_key DROP NOT NULL;

-- 3. Drop the new queue_communication_event_nonblocking function (didn't exist at 3:40am)
DROP FUNCTION IF EXISTS queue_communication_event_nonblocking(uuid, text, text, jsonb);

-- 4. Restore the original admin_update_order_status_bulletproof function (3:40am version)
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
BEGIN
    -- Validate status
    IF p_new_status IS NULL OR p_new_status = 'null' OR p_new_status = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Status cannot be null or empty');
    END IF;

    IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid status value');
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
    
    -- Queue emails for statuses that should trigger notifications (3:40am version - direct insert)
    IF p_new_status = ANY(v_email_statuses) AND v_order_record.customer_email IS NOT NULL THEN
        -- Map status to template key
        v_template_key := CASE p_new_status
            WHEN 'confirmed' THEN 'order_confirmed'
            WHEN 'preparing' THEN 'order_preparing'
            WHEN 'ready' THEN 'order_ready'
            WHEN 'out_for_delivery' THEN 'order_out_for_delivery'
            WHEN 'delivered' THEN 'order_delivered'
            WHEN 'cancelled' THEN 'order_cancelled'
            ELSE NULL
        END;
        
        -- Direct insert into communication_events (3:40am approach)
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
    
    -- Log the status change
    INSERT INTO audit_logs (
        action, category, message, user_id, entity_id, old_values, new_values
    ) VALUES (
        'order_status_updated',
        'Order Management',
        'Order status updated from ' || v_old_status || ' to ' || p_new_status,
        p_admin_id,
        p_order_id,
        jsonb_build_object('status', v_old_status),
        jsonb_build_object('status', p_new_status)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Order status updated successfully',
        'order', row_to_json(v_order_record),
        'email_queued', (p_new_status = ANY(v_email_statuses))
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$function$;