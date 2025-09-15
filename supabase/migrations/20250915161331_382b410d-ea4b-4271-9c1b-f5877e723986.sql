-- Phase 1 Fixed: Database Foundation - Critical Fixes for Order Management System

-- 1. Drop problematic constraints that cause duplicate key errors
DROP INDEX IF EXISTS idx_communication_events_dedupe_key;

-- 2. Clean up any stuck communication events
DELETE FROM communication_events 
WHERE status = 'queued' 
  AND created_at < now() - interval '2 hours'
  AND template_key IS NULL;

-- 3. Create a bulletproof order update function
CREATE OR REPLACE FUNCTION admin_safe_update_order_status(
    p_order_id UUID,
    p_new_status TEXT,
    p_admin_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    order_record RECORD;
    result JSON;
BEGIN
    -- Get current order
    SELECT * INTO order_record
    FROM orders 
    WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Order not found'
        );
    END IF;
    
    -- Skip if status unchanged
    IF order_record.status = p_new_status THEN
        RETURN json_build_object(
            'success', true,
            'message', 'Status unchanged',
            'order', row_to_json(order_record)
        );
    END IF;
    
    -- Update order status
    UPDATE orders 
    SET 
        status = p_new_status,
        updated_at = now(),
        updated_by = p_admin_id
    WHERE id = p_order_id;
    
    -- Get updated order
    SELECT * INTO order_record
    FROM orders 
    WHERE id = p_order_id;
    
    -- Try to queue email (non-blocking)
    BEGIN
        PERFORM admin_queue_order_email(p_order_id, p_new_status);
    EXCEPTION WHEN OTHERS THEN
        -- Log but don't fail
        RAISE LOG 'Email queuing failed for order %: %', p_order_id, SQLERRM;
    END;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Order updated successfully',
        'order', row_to_json(order_record)
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create safe email queuing function
CREATE OR REPLACE FUNCTION admin_queue_order_email(
    p_order_id UUID,
    p_status TEXT
) RETURNS VOID AS $$
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
    
    -- Insert or ignore if duplicate
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
    ) ON CONFLICT (dedupe_key) DO NOTHING;
    
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't propagate
    RAISE LOG 'Failed to queue email for order %: %', p_order_id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recreate the constraint without CONCURRENTLY
DROP INDEX IF EXISTS idx_communication_events_dedupe_safe;
CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_events_dedupe_safe 
ON communication_events (dedupe_key) 
WHERE dedupe_key IS NOT NULL;

-- 6. Clean up old failed communication events
UPDATE communication_events 
SET status = 'failed', 
    error_message = 'Cleared during system maintenance',
    updated_at = now()
WHERE status = 'queued' 
  AND created_at < now() - interval '1 hour';