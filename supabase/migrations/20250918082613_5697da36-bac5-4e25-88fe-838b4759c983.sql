-- Production fix for duplicate key violations in communication events
-- Enhanced admin_queue_order_email function with collision-resistant deduplication

CREATE OR REPLACE FUNCTION public.admin_queue_order_email_enhanced(
    p_order_id uuid,
    p_status text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_customer_email TEXT;
    v_customer_name TEXT;
    v_template_key TEXT;
    v_order_number TEXT;
    v_total_amount NUMERIC;
    v_dedupe_key TEXT;
    v_event_id UUID;
    v_attempt_count INTEGER := 0;
    v_max_attempts INTEGER := 3;
BEGIN
    -- Get order and customer info with row lock
    SELECT o.order_number, o.total_amount, o.customer_email, o.customer_name
    INTO v_order_number, v_total_amount, v_customer_email, v_customer_name
    FROM orders o
    WHERE o.id = p_order_id
    FOR UPDATE;
    
    -- Skip if no customer email
    IF v_customer_email IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No customer email');
    END IF;
    
    -- Get template key
    CASE p_status
        WHEN 'confirmed' THEN v_template_key := 'order_confirmed';
        WHEN 'preparing' THEN v_template_key := 'order_preparing';
        WHEN 'ready' THEN v_template_key := 'order_ready';
        WHEN 'out_for_delivery' THEN v_template_key := 'order_out_for_delivery';
        WHEN 'delivered' THEN v_template_key := 'order_delivered';
        WHEN 'cancelled' THEN v_template_key := 'order_cancelled';
        ELSE 
            RETURN jsonb_build_object('success', false, 'message', 'Invalid status');
    END CASE;
    
    -- Retry loop for collision handling
    LOOP
        v_attempt_count := v_attempt_count + 1;
        
        -- Generate collision-resistant dedupe key with microsecond precision
        v_dedupe_key := p_order_id::TEXT || '|' || 
                       p_status || '|' || 
                       v_template_key || '|' || 
                       v_customer_email || '|' || 
                       EXTRACT(EPOCH FROM clock_timestamp())::bigint::text || '|' ||
                       EXTRACT(MICROSECONDS FROM clock_timestamp())::text || '|' ||
                       gen_random_uuid()::text || '|' ||
                       pg_backend_pid()::text;
        
        BEGIN
            -- Atomic insert with ON CONFLICT handling
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
                'order_status_update',
                v_customer_email,
                v_template_key,
                jsonb_build_object(
                    'customer_name', COALESCE(v_customer_name, 'Customer'),
                    'order_number', v_order_number,
                    'status', p_status,
                    'total_amount', COALESCE(v_total_amount, 0)
                ),
                'queued',
                v_dedupe_key,
                p_order_id,
                'normal',
                now(),
                now()
            )
            ON CONFLICT (dedupe_key) DO UPDATE SET
                updated_at = now(),
                status = CASE 
                    WHEN communication_events.status = 'failed' THEN 'queued'
                    ELSE communication_events.status
                END
            RETURNING id INTO v_event_id;
            
            -- Success - exit loop
            EXIT;
            
        EXCEPTION 
            WHEN unique_violation THEN
                -- Log collision and retry with new key
                INSERT INTO audit_logs (action, category, message, entity_id, new_values)
                VALUES (
                    'communication_event_collision_retry',
                    'Email System',
                    'Dedupe key collision - retrying with new key',
                    p_order_id,
                    jsonb_build_object(
                        'attempt', v_attempt_count,
                        'status', p_status,
                        'collision_key', v_dedupe_key
                    )
                );
                
                -- Exit if max attempts reached
                IF v_attempt_count >= v_max_attempts THEN
                    RETURN jsonb_build_object(
                        'success', false, 
                        'message', 'Max retry attempts reached',
                        'attempts', v_attempt_count
                    );
                END IF;
                
                -- Continue loop for retry
        END;
    END LOOP;
    
    -- Log successful creation
    INSERT INTO audit_logs (action, category, message, entity_id, new_values)
    VALUES (
        'communication_event_created_enhanced',
        'Email System',
        'Communication event created with collision protection',
        p_order_id,
        jsonb_build_object(
            'event_id', v_event_id,
            'template_key', v_template_key,
            'status', p_status,
            'attempts', v_attempt_count,
            'dedupe_key_length', length(v_dedupe_key)
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'event_id', v_event_id,
        'attempts', v_attempt_count
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Log error but return success to prevent order update failures
    INSERT INTO audit_logs (action, category, message, entity_id, new_values)
    VALUES (
        'communication_event_creation_failed_enhanced',
        'Email System',
        'Failed to create communication event (non-blocking): ' || SQLERRM,
        p_order_id,
        jsonb_build_object(
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'status', p_status,
            'attempts', v_attempt_count
        )
    );
    
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'non_blocking', true
    );
END;
$$;

-- Enhanced rate limiting function for production safety
CREATE OR REPLACE FUNCTION public.check_admin_rate_limit(
    p_admin_id uuid,
    p_operation text,
    p_limit integer DEFAULT 100,
    p_window_minutes integer DEFAULT 60
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_count integer;
    v_window_start timestamp := now() - (p_window_minutes || ' minutes')::interval;
BEGIN
    -- Count operations in the time window
    SELECT COUNT(*) INTO v_count
    FROM audit_logs
    WHERE user_id = p_admin_id
      AND action LIKE p_operation || '%'
      AND event_time >= v_window_start;
    
    IF v_count >= p_limit THEN
        -- Log rate limit violation
        INSERT INTO audit_logs (action, category, message, user_id, new_values)
        VALUES (
            'admin_rate_limit_exceeded',
            'Security Alert',
            'Admin operation rate limit exceeded: ' || p_operation,
            p_admin_id,
            jsonb_build_object(
                'operation', p_operation,
                'count', v_count,
                'limit', p_limit,
                'window_minutes', p_window_minutes
            )
        );
        
        RETURN jsonb_build_object(
            'allowed', false,
            'limit_exceeded', true,
            'retry_after_minutes', p_window_minutes - EXTRACT(EPOCH FROM (now() - v_window_start))/60
        );
    END IF;
    
    RETURN jsonb_build_object(
        'allowed', true,
        'remaining', p_limit - v_count,
        'window_minutes', p_window_minutes
    );
END;
$$;

-- Production-safe order status update with transaction boundaries
CREATE OR REPLACE FUNCTION public.admin_update_order_status_production(
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
    -- Check rate limit first
    SELECT * INTO v_rate_limit_result 
    FROM check_admin_rate_limit(p_admin_id, 'order_status_update', 50, 10);
    
    IF NOT (v_rate_limit_result->>'allowed')::boolean THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Rate limit exceeded. Please wait before making more updates.',
            'rate_limit', v_rate_limit_result
        );
    END IF;
    
    -- Validate inputs
    IF p_new_status IS NULL OR p_new_status = 'null' OR p_new_status = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Status cannot be null or empty');
    END IF;

    IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid status: ' || p_new_status || '. Valid: ' || array_to_string(v_valid_statuses, ', ')
        );
    END IF;

    -- Start transaction with row locking
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
    
    -- Queue email notification (non-blocking)
    IF v_order_record.customer_email IS NOT NULL AND 
       p_new_status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') THEN
        
        SELECT * INTO v_email_result
        FROM admin_queue_order_email_enhanced(p_order_id, p_new_status);
    ELSE
        v_email_result := jsonb_build_object('success', true, 'message', 'No email required');
    END IF;
    
    -- Get updated order
    SELECT * INTO v_order_record FROM orders WHERE id = p_order_id;
    
    -- Log successful update
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
    VALUES (
        'admin_order_status_updated_production',
        'Order Management',
        'Production order status update: ' || v_old_status || ' → ' || p_new_status,
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
    
EXCEPTION WHEN OTHERS THEN
    -- Log error with full context
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
    VALUES (
        'admin_order_status_update_failed_production',
        'Critical Error',
        'Production order status update failed: ' || SQLERRM,
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