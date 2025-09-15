-- Fix critical production issues in admin_safe_update_order_status function
CREATE OR REPLACE FUNCTION public.admin_safe_update_order_status(p_order_id uuid, p_new_status text, p_admin_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_record RECORD;
  v_old_status text;
  v_email_result jsonb;
  v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
  v_unique_suffix text;
  v_dedupe_key text;
  v_attempt_count integer := 0;
BEGIN
  -- Validate status enum value and handle null
  IF p_new_status IS NULL OR p_new_status = 'null' OR p_new_status = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Status cannot be null or empty'
    );
  END IF;

  IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid status value: ' || p_new_status || '. Valid values are: ' || array_to_string(v_valid_statuses, ', ')
    );
  END IF;

  -- Get current order
  SELECT * INTO v_order_record
  FROM orders 
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  v_old_status := v_order_record.status::text;
  
  -- Skip if status unchanged
  IF v_old_status = p_new_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Status unchanged',
      'order', row_to_json(v_order_record)
    );
  END IF;
  
  -- Update order status with explicit enum casting and null protection
  UPDATE orders 
  SET 
    status = CASE 
      WHEN p_new_status IS NOT NULL AND p_new_status != 'null' AND p_new_status != '' 
      THEN p_new_status::order_status 
      ELSE status 
    END,
    updated_at = now(),
    updated_by = p_admin_id
  WHERE id = p_order_id;
  
  -- Get updated order
  SELECT * INTO v_order_record
  FROM orders 
  WHERE id = p_order_id;
  
  -- Queue email notification (non-blocking) with robust dedupe key
  IF v_order_record.customer_email IS NOT NULL AND 
     p_new_status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') THEN
    
    BEGIN
      -- Generate truly unique dedupe key with multiple entropy sources
      v_unique_suffix := gen_random_uuid()::text || '_' || 
                        EXTRACT(EPOCH FROM clock_timestamp())::bigint::text || '_' ||
                        EXTRACT(MICROSECONDS FROM clock_timestamp())::text || '_' ||
                        pg_backend_pid()::text;
                        
      v_dedupe_key := p_order_id::text || '|status_' || p_new_status || '|' || v_unique_suffix;
      
      -- Retry loop for collision handling
      LOOP
        v_attempt_count := v_attempt_count + 1;
        
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
            'order_status_update',
            v_order_record.customer_email,
            'order_status_' || p_new_status,
            jsonb_build_object(
              'customer_name', COALESCE(v_order_record.customer_name, 'Customer'),
              'order_number', v_order_record.order_number,
              'status', p_new_status,
              'total_amount', v_order_record.total_amount
            ),
            'queued',
            v_dedupe_key,
            p_order_id,
            now(),
            now()
          );
          
          -- Success - exit loop
          EXIT;
          
        EXCEPTION 
          WHEN unique_violation THEN
            -- Generate new unique suffix and retry
            IF v_attempt_count >= 3 THEN
              -- Use ON CONFLICT as final fallback
              INSERT INTO communication_events (
                event_type, recipient_email, template_key, template_variables,
                status, dedupe_key, order_id, created_at, updated_at
              ) VALUES (
                'order_status_update', v_order_record.customer_email, 'order_status_' || p_new_status,
                jsonb_build_object(
                  'customer_name', COALESCE(v_order_record.customer_name, 'Customer'),
                  'order_number', v_order_record.order_number,
                  'status', p_new_status,
                  'total_amount', v_order_record.total_amount
                ),
                'queued', v_dedupe_key, p_order_id, now(), now()
              )
              ON CONFLICT (dedupe_key) DO UPDATE SET
                updated_at = now(),
                status = CASE WHEN communication_events.status = 'failed' THEN 'queued' ELSE communication_events.status END;
              EXIT;
            END IF;
            
            -- Generate new unique key for retry
            v_unique_suffix := gen_random_uuid()::text || '_' || 
                              EXTRACT(EPOCH FROM clock_timestamp())::bigint::text || '_' ||
                              EXTRACT(MICROSECONDS FROM clock_timestamp())::text || '_' ||
                              pg_backend_pid()::text || '_retry' || v_attempt_count::text;
            v_dedupe_key := p_order_id::text || '|status_' || p_new_status || '|' || v_unique_suffix;
        END;
      END LOOP;
      
      v_email_result := jsonb_build_object('success', true, 'attempts', v_attempt_count);
      
    EXCEPTION WHEN OTHERS THEN
      -- Log but don't fail the order update
      INSERT INTO audit_logs (action, category, message, entity_id, new_values)
      VALUES (
        'order_status_email_failed',
        'Email System',
        'Failed to queue email for status change: ' || SQLERRM,
        p_order_id,
        jsonb_build_object(
          'error', SQLERRM,
          'old_status', v_old_status,
          'new_status', p_new_status
        )
      );
      v_email_result := jsonb_build_object('success', false, 'error', SQLERRM);
    END;
  END IF;
  
  -- Log status change
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
  VALUES (
    'admin_order_status_updated',
    'Order Management',
    'Order status updated from ' || v_old_status || ' to ' || p_new_status,
    p_admin_id,
    p_order_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_new_status, 'email_result', v_email_result)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order updated successfully',
    'order', row_to_json(v_order_record)
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Database error: ' || SQLERRM
  );
END;
$function$;

-- Fix start_delivery function to handle null values properly
CREATE OR REPLACE FUNCTION public.start_delivery(p_order_id uuid, p_rider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_rider RECORD;
  v_old_rider_id uuid;
  v_result jsonb;
BEGIN
  -- Authorization: allow admins or service role
  IF NOT (is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Only admins or service roles can start delivery';
  END IF;

  -- Load and validate order
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status NOT IN ('confirmed','preparing','ready') THEN
    RAISE EXCEPTION 'Order not in a startable status (%). Must be confirmed/preparing/ready', v_order.status;
  END IF;

  -- Validate rider
  SELECT * INTO v_rider
  FROM drivers
  WHERE id = p_rider_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rider not found or not active';
  END IF;

  -- Track previous assignment
  v_old_rider_id := v_order.assigned_rider_id;

  -- Ensure single assignment row by removing old record(s)
  DELETE FROM order_assignments WHERE order_id = p_order_id;

  -- Create new assignment
  INSERT INTO order_assignments (order_id, rider_id, assigned_by)
  VALUES (p_order_id, p_rider_id, auth.uid());

  -- Update order: assign rider then set status to out_for_delivery (with proper enum casting)
  UPDATE orders
  SET assigned_rider_id = p_rider_id,
      status = 'out_for_delivery'::order_status,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Audit
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
  VALUES (
    'start_delivery',
    'Order Management',
    'Assigned rider and moved order to out_for_delivery',
    auth.uid(),
    p_order_id,
    jsonb_build_object('old_rider_id', v_old_rider_id, 'old_status', v_order.status),
    jsonb_build_object('new_rider_id', p_rider_id, 'new_status', 'out_for_delivery')
  );

  -- Return compact result
  SELECT jsonb_build_object(
    'success', true,
    'order_id', o.id,
    'status', o.status::text,
    'assigned_rider_id', o.assigned_rider_id,
    'updated_at', o.updated_at
  )
  INTO v_result
  FROM orders o
  WHERE o.id = p_order_id;

  RETURN v_result;
END;
$function$;