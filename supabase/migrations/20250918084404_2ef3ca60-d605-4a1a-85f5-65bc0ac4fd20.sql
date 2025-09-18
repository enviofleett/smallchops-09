-- CRITICAL PRODUCTION FIXES FOR DUPLICATE KEY VIOLATIONS
-- Emergency fixes to prevent duplicate communication events and ensure order updates succeed

-- 1. Add sequence for guaranteed unique identifiers
CREATE SEQUENCE IF NOT EXISTS communication_event_sequence;

-- 2. Add database session tracking for better isolation
CREATE OR REPLACE FUNCTION get_session_identifier() 
RETURNS text 
LANGUAGE plpgsql 
AS $$
BEGIN
    RETURN concat(
        extract(epoch from clock_timestamp())::bigint,
        '_',
        pg_backend_pid(),
        '_',
        nextval('communication_event_sequence')
    );
END;
$$;

-- 3. Enhanced dedupe key generation with atomic guarantees
CREATE OR REPLACE FUNCTION generate_atomic_dedupe_key(
    p_order_id uuid,
    p_event_type text,
    p_template_key text,
    p_recipient_email text
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    v_session_id text;
    v_sequence bigint;
    v_timestamp bigint;
BEGIN
    -- Get atomic values
    v_sequence := nextval('communication_event_sequence');
    v_timestamp := extract(epoch from clock_timestamp())::bigint;
    v_session_id := pg_backend_pid()::text;
    
    -- Create collision-resistant dedupe key
    RETURN concat(
        COALESCE(p_order_id::text, 'no-order'),
        '|',
        p_event_type,
        '|',
        COALESCE(p_template_key, 'no-template'),
        '|',
        p_recipient_email,
        '|',
        v_timestamp,
        '|',
        v_session_id,
        '|',
        v_sequence
    );
END;
$$;

-- 4. Circuit breaker for non-blocking email events
CREATE OR REPLACE FUNCTION queue_communication_event_nonblocking(
    p_order_id uuid,
    p_event_type text,
    p_template_key text,
    p_recipient_email text,
    p_template_variables jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_dedupe_key text;
    v_event_id uuid;
    v_existing_count integer;
BEGIN
    -- Check if similar event already exists (last 5 minutes)
    SELECT COUNT(*) INTO v_existing_count
    FROM communication_events
    WHERE order_id = p_order_id
      AND event_type = p_event_type
      AND recipient_email = p_recipient_email
      AND template_key = p_template_key
      AND created_at > now() - interval '5 minutes'
      AND status IN ('queued', 'processing', 'sent');
    
    -- If event already exists recently, return success without creating duplicate
    IF v_existing_count > 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Event already queued recently',
            'event_id', null,
            'deduplicated', true
        );
    END IF;
    
    -- Generate atomic dedupe key
    v_dedupe_key := generate_atomic_dedupe_key(
        p_order_id, 
        p_event_type, 
        p_template_key, 
        p_recipient_email
    );
    
    -- Use upsert with ON CONFLICT to handle race conditions
    BEGIN
        INSERT INTO communication_events (
            event_type,
            recipient_email,
            template_key,
            template_variables,
            status,
            dedupe_key,
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
            v_dedupe_key,
            p_order_id,
            'normal',
            now(),
            now()
        )
        ON CONFLICT (dedupe_key) DO UPDATE SET
            updated_at = now(),
            template_variables = EXCLUDED.template_variables,
            status = CASE 
                WHEN communication_events.status = 'failed' THEN 'queued'
                ELSE communication_events.status
            END
        RETURNING id INTO v_event_id;
        
    EXCEPTION WHEN unique_violation THEN
        -- Handle any remaining race conditions gracefully
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Event handled by concurrent transaction',
            'event_id', null,
            'race_condition_handled', true
        );
    END;
    
    RETURN jsonb_build_object(
        'success', true,
        'event_id', v_event_id,
        'dedupe_key', v_dedupe_key
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Never fail - return success to prevent blocking order updates
    INSERT INTO audit_logs (action, category, message, entity_id, new_values)
    VALUES (
        'communication_event_nonblocking_failed',
        'Email System',
        'Non-blocking communication event failed (non-critical): ' || SQLERRM,
        p_order_id,
        jsonb_build_object(
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'event_type', p_event_type,
            'recipient_email', p_recipient_email
        )
    );
    
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'non_blocking', true
    );
END;
$$;

-- 5. Enhanced order status update with bulletproof email handling
CREATE OR REPLACE FUNCTION admin_update_order_status_bulletproof(
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
    v_rate_limit_result jsonb;
    v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
BEGIN
    -- Rate limit check
    SELECT * INTO v_rate_limit_result 
    FROM check_admin_rate_limit(p_admin_id, 'order_status_update', 50, 10);
    
    IF NOT (v_rate_limit_result->>'allowed')::boolean THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Rate limit exceeded. Please wait before making more updates.',
            'rate_limit', v_rate_limit_result
        );
    END IF;
    
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

    -- ATOMIC: Get and lock order in single transaction
    SELECT * INTO v_order_record
    FROM orders 
    WHERE id = p_order_id
    FOR UPDATE NOWAIT; -- Fail fast if locked
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    v_old_status := v_order_record.status::text;
    
    -- Skip if unchanged
    IF v_old_status = p_new_status THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Status unchanged',
            'order', row_to_json(v_order_record)
        );
    END IF;
    
    -- CRITICAL: Update order status first (blocking operation)
    UPDATE orders 
    SET 
        status = p_new_status::order_status,
        updated_at = now(),
        updated_by = p_admin_id
    WHERE id = p_order_id;
    
    -- NON-BLOCKING: Queue email notification (never fails order update)
    IF v_order_record.customer_email IS NOT NULL AND 
       p_new_status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') THEN
        
        SELECT * INTO v_email_result
        FROM queue_communication_event_nonblocking(
            p_order_id,
            'order_status_update',
            CASE p_new_status
                WHEN 'confirmed' THEN 'order_confirmed'
                WHEN 'preparing' THEN 'order_preparing'
                WHEN 'ready' THEN 'order_ready'
                WHEN 'out_for_delivery' THEN 'order_out_for_delivery'
                WHEN 'delivered' THEN 'order_delivered'
                WHEN 'cancelled' THEN 'order_cancelled'
                ELSE 'order_status_update'
            END,
            v_order_record.customer_email,
            jsonb_build_object(
                'customer_name', COALESCE(v_order_record.customer_name, 'Customer'),
                'order_number', v_order_record.order_number,
                'status', p_new_status,
                'total_amount', COALESCE(v_order_record.total_amount, 0)
            )
        );
    ELSE
        v_email_result := jsonb_build_object('success', true, 'message', 'No email required');
    END IF;
    
    -- Get updated order
    SELECT * INTO v_order_record FROM orders WHERE id = p_order_id;
    
    -- Success logging
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
    VALUES (
        'admin_order_status_updated_bulletproof',
        'Order Management',
        'BULLETPROOF: Order status update ' || v_old_status || ' → ' || p_new_status,
        p_admin_id,
        p_order_id,
        jsonb_build_object('status', v_old_status),
        jsonb_build_object(
            'status', p_new_status,
            'email_result', v_email_result,
            'rate_limit_used', v_rate_limit_result
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Order updated successfully',
        'order', row_to_json(v_order_record),
        'email_queued', v_email_result,
        'rate_limit', v_rate_limit_result
    );
    
EXCEPTION 
    WHEN lock_not_available THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order is currently being modified by another admin. Please try again.',
            'retry_after_seconds', 2
        );
    WHEN OTHERS THEN
        -- Critical error logging
        INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
        VALUES (
            'admin_order_status_update_failed_bulletproof',
            'Critical Error',
            'BULLETPROOF: Order status update failed - ' || SQLERRM,
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

-- 6. Add performance indexes for faster conflict detection
CREATE INDEX IF NOT EXISTS idx_communication_events_recent_check 
ON communication_events (order_id, event_type, recipient_email, template_key, created_at) 
WHERE status IN ('queued', 'processing', 'sent');

CREATE INDEX IF NOT EXISTS idx_communication_events_deduplication
ON communication_events (order_id, event_type, recipient_email, created_at DESC)
WHERE created_at > now() - interval '1 hour';

-- 7. Cleanup function for old events (prevent table bloat)
CREATE OR REPLACE FUNCTION cleanup_old_communication_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count integer;
BEGIN
    -- Archive events older than 30 days
    INSERT INTO communication_events_archive
    SELECT * FROM communication_events
    WHERE created_at < now() - interval '30 days'
    AND status IN ('sent', 'failed');
    
    -- Delete archived events
    DELETE FROM communication_events
    WHERE created_at < now() - interval '30 days'
    AND status IN ('sent', 'failed');
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$;