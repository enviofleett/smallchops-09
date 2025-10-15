-- CRITICAL FIX: Remove duplicate email triggers and fix function parameter order
-- Phase 1: Clean up existing NULL template_keys FIRST

-- ============================================================================
-- CLEANUP PHASE: Delete all NULL template_key events immediately
-- ============================================================================

-- Delete ALL communication events with NULL template_key (these are the spam)
DELETE FROM communication_events WHERE template_key IS NULL;

-- Log the cleanup
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
    'spam_email_deleted',
    'Email System',
    'Deleted all communication events with NULL template_key',
    jsonb_build_object('timestamp', now())
);

-- ============================================================================
-- LAYER 1: DROP ALL DUPLICATE EMAIL TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_log_order_status_change_with_email ON orders;
DROP TRIGGER IF EXISTS trigger_order_emails ON orders;
DROP TRIGGER IF EXISTS trigger_order_status_email ON orders;
DROP TRIGGER IF EXISTS trigger_order_payment_email ON orders;
DROP TRIGGER IF EXISTS trigger_payment_confirmation_email ON orders;

-- ============================================================================
-- LAYER 2: FIX admin_update_order_status_bulletproof FUNCTION
-- Fix parameter order when calling queue_communication_event_nonblocking
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_update_order_status_bulletproof(
    p_order_id UUID,
    p_new_status TEXT,
    p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_record RECORD;
    v_old_status TEXT;
    v_email_result JSONB;
    v_valid_statuses TEXT[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
    v_template_key TEXT;
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
    
    -- Determine template key
    v_template_key := CASE p_new_status
        WHEN 'confirmed' THEN 'order_confirmation'
        WHEN 'preparing' THEN 'order_preparing'
        WHEN 'ready' THEN 'order_ready'
        WHEN 'out_for_delivery' THEN 'order_out_for_delivery'
        WHEN 'delivered' THEN 'order_delivered'
        WHEN 'cancelled' THEN 'order_cancelled'
        ELSE NULL
    END;
    
    -- Queue email notification (non-blocking) with CORRECT parameter order
    IF v_order_record.customer_email IS NOT NULL AND v_template_key IS NOT NULL THEN
        BEGIN
            SELECT * INTO v_email_result
            FROM queue_communication_event_nonblocking(
                'order_status_update',              -- p_event_type (1st)
                v_order_record.customer_email,      -- p_recipient_email (2nd)
                v_template_key,                     -- p_template_key (3rd) ✅ FIXED ORDER
                jsonb_build_object(                 -- p_template_variables (4th)
                    'customer_name', COALESCE(v_order_record.customer_name, 'Customer'),
                    'order_number', v_order_record.order_number,
                    'status', p_new_status,
                    'total_amount', COALESCE(v_order_record.total_amount, 0)
                ),
                p_order_id,                         -- p_order_id (5th)
                'normal'                            -- p_priority (6th)
            );
        EXCEPTION WHEN OTHERS THEN
            -- Log error but don't fail order update
            INSERT INTO audit_logs (action, category, message, entity_id, new_values)
            VALUES ('email_queue_failed_non_blocking', 'Email System', 'Failed to queue email: ' || SQLERRM, p_order_id, jsonb_build_object('error', SQLERRM));
        END;
    END IF;
    
    -- Log status change
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
    VALUES (
        'order_status_updated',
        'Order Management',
        'Order status updated from ' || v_old_status || ' to ' || p_new_status,
        p_admin_id,
        p_order_id,
        jsonb_build_object('status', v_old_status),
        jsonb_build_object('status', p_new_status, 'email_queued', v_email_result)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Order status updated successfully',
        'order', row_to_json(v_order_record),
        'email_result', v_email_result
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

-- ============================================================================
-- LAYER 3: ADD VALIDATION TO communication_events
-- Prevent NULL template_keys from being inserted going forward
-- ============================================================================

-- Now that all NULL values are deleted, add NOT NULL constraint
ALTER TABLE communication_events 
ALTER COLUMN template_key SET NOT NULL;

-- Log final success
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
    'spam_email_fix_complete',
    'Email System',
    'Spam email fix complete: Removed duplicate triggers, fixed function parameter order, added NOT NULL constraint',
    jsonb_build_object(
        'triggers_dropped', 5,
        'function_fixed', 'admin_update_order_status_bulletproof',
        'constraint_added', 'template_key NOT NULL',
        'null_events_deleted', true
    )
);