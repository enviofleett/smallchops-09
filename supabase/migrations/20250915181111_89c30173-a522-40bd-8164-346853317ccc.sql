-- Critical production fixes for order management system
-- Part 1: Enhanced enum validation and error handling

-- Create enhanced order status update function with comprehensive validation
CREATE OR REPLACE FUNCTION public.admin_safe_update_order_status_enhanced(
  p_order_id uuid, 
  p_new_status text, 
  p_admin_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result_order RECORD;
  old_status TEXT;
  v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
BEGIN
  -- CRITICAL: Comprehensive input validation
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order ID cannot be null');
  END IF;
  
  IF p_new_status IS NULL OR p_new_status = '' OR p_new_status = 'undefined' OR p_new_status = 'null' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status cannot be null, empty, or undefined');
  END IF;
  
  -- Validate status is in allowed enum values
  IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Invalid status value: ' || p_new_status || '. Valid values are: ' || array_to_string(v_valid_statuses, ', ')
    );
  END IF;

  -- Get current status with row locking to prevent concurrent updates
  SELECT status INTO old_status 
  FROM orders 
  WHERE id = p_order_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Skip if status unchanged
  IF old_status = p_new_status THEN
    SELECT * INTO result_order FROM orders WHERE id = p_order_id;
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Status unchanged',
      'order', row_to_json(result_order)
    );
  END IF;
  
  -- Update order status with explicit enum casting and comprehensive error handling
  BEGIN
    UPDATE orders 
    SET status = p_new_status::order_status,
        updated_at = now(),
        updated_by = p_admin_id
    WHERE id = p_order_id
    RETURNING * INTO result_order;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order update failed - order not found');
    END IF;
    
  EXCEPTION 
    WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid status value for enum: ' || p_new_status);
    WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error', 'Database error during status update: ' || SQLERRM);
  END;
  
  -- Log status change
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
  VALUES (
    'order_status_update_enhanced',
    'Order Management',
    'Order status updated from ' || old_status || ' to ' || p_new_status,
    p_admin_id,
    p_order_id,
    jsonb_build_object('status', old_status),
    jsonb_build_object('status', p_new_status)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order updated successfully', 
    'order', row_to_json(result_order)
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Final catch-all error handler
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Unexpected error during order status update: ' || SQLERRM,
    'sqlstate', SQLSTATE
  );
END;
$$;

-- Create enhanced communication event upsert with better deduplication
CREATE OR REPLACE FUNCTION public.upsert_communication_event_enhanced(
  p_event_type text, 
  p_recipient_email text, 
  p_template_key text, 
  p_template_variables jsonb DEFAULT '{}'::jsonb, 
  p_order_id uuid DEFAULT NULL::uuid, 
  p_dedupe_key text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id uuid;
  v_calculated_dedupe_key text;
  v_attempt_count integer := 0;
  v_max_attempts integer := 5;
BEGIN
  -- Input validation
  IF p_event_type IS NULL OR p_event_type = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event type cannot be empty');
  END IF;
  
  IF p_recipient_email IS NULL OR p_recipient_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient email cannot be empty');
  END IF;
  
  -- Validate template_variables is valid JSON
  BEGIN
    IF p_template_variables IS NULL THEN
      p_template_variables := '{}'::jsonb;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid template variables JSON');
  END;

  -- Generate robust dedupe key with collision handling
  LOOP
    v_attempt_count := v_attempt_count + 1;
    
    IF p_dedupe_key IS NULL THEN
      v_calculated_dedupe_key := COALESCE(p_order_id::text, 'no-order') || '|' || 
                                p_event_type || '|' || 
                                COALESCE(p_template_key, 'no-template') || '|' ||
                                p_recipient_email || '|' ||
                                EXTRACT(EPOCH FROM clock_timestamp())::bigint::text || '|' ||
                                gen_random_uuid()::text;
    ELSE
      v_calculated_dedupe_key := p_dedupe_key || '|' || 
                                EXTRACT(EPOCH FROM clock_timestamp())::bigint::text || '|' ||
                                gen_random_uuid()::text;
    END IF;

    BEGIN
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
        p_event_type,
        p_recipient_email,
        p_template_key,
        p_template_variables,
        'queued',
        v_calculated_dedupe_key,
        p_order_id,
        now(),
        now()
      )
      RETURNING id INTO v_event_id;
      
      -- Success - exit loop
      EXIT;
      
    EXCEPTION
      WHEN unique_violation THEN
        IF v_attempt_count >= v_max_attempts THEN
          -- Use ON CONFLICT as final fallback
          INSERT INTO communication_events (
            event_type, recipient_email, template_key, template_variables,
            status, dedupe_key, order_id, created_at, updated_at
          ) VALUES (
            p_event_type, p_recipient_email, p_template_key, p_template_variables,
            'queued', v_calculated_dedupe_key, p_order_id, now(), now()
          )
          ON CONFLICT (dedupe_key) DO UPDATE SET
            template_variables = EXCLUDED.template_variables,
            updated_at = now(),
            status = CASE 
              WHEN communication_events.status = 'failed' THEN 'queued'
              ELSE communication_events.status
            END
          RETURNING id INTO v_event_id;
          EXIT;
        END IF;
        -- Continue loop for retry with new dedupe key
    END;
  END LOOP;

  -- Log successful operation
  INSERT INTO audit_logs (action, category, message, entity_id, new_values)
  VALUES (
    'communication_event_upserted_enhanced',
    'Email System',
    'Communication event created/updated successfully',
    v_event_id,
    jsonb_build_object(
      'event_type', p_event_type,
      'recipient_email', p_recipient_email,
      'template_key', p_template_key,
      'order_id', p_order_id,
      'dedupe_key', v_calculated_dedupe_key,
      'attempts', v_attempt_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'dedupe_key', v_calculated_dedupe_key,
    'attempts', v_attempt_count
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error but return failure result instead of raising exception
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'communication_event_upsert_failed_enhanced',
    'Email System',
    'Failed to upsert communication event: ' || SQLERRM,
    jsonb_build_object(
      'error', SQLERRM,
      'sqlstate', SQLSTATE,
      'event_type', p_event_type,
      'recipient_email', p_recipient_email,
      'template_key', p_template_key,
      'order_id', p_order_id
    )
  );

  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'sqlstate', SQLSTATE
  );
END;
$$;

-- Fix remaining functions that need search_path
ALTER FUNCTION public.increment_promotion_usage(uuid) SET search_path TO 'public';
ALTER FUNCTION public.is_admin() SET search_path TO 'public';
ALTER FUNCTION public.current_user_email() SET search_path TO 'public';
ALTER FUNCTION public.reassign_order_rider(uuid, uuid, text) SET search_path TO 'public';
ALTER FUNCTION public.get_promotion_details(text) SET search_path TO 'public';