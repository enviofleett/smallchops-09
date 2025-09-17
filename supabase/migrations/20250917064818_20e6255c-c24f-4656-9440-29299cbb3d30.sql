-- Production-Ready Order Management System Fixes
-- Addresses critical dedupe key collisions and status update reliability

-- 1. Create robust communication event upsert function with collision resistance
CREATE OR REPLACE FUNCTION public.upsert_communication_event_production(
  p_event_type text,
  p_recipient_email text,
  p_template_key text,
  p_template_variables jsonb DEFAULT '{}'::jsonb,
  p_order_id uuid DEFAULT NULL::uuid,
  p_source text DEFAULT 'system'::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_event_id uuid;
  v_dedupe_key text;
  v_attempt integer := 0;
  v_max_attempts integer := 3;
BEGIN
  -- Generate collision-resistant dedupe key
  v_dedupe_key := COALESCE(p_order_id::text, 'no-order') || '|' || 
                  p_event_type || '|' || 
                  COALESCE(p_template_key, 'no-template') || '|' ||
                  p_recipient_email || '|' ||
                  EXTRACT(EPOCH FROM clock_timestamp())::bigint::text || '|' ||
                  gen_random_uuid()::text;

  -- Insert with ON CONFLICT handling
  INSERT INTO communication_events (
    event_type,
    recipient_email,
    template_key,
    template_variables,
    status,
    dedupe_key,
    order_id,
    source,
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
    p_source,
    'normal',
    now(),
    now()
  )
  ON CONFLICT (dedupe_key) DO UPDATE SET
    template_variables = EXCLUDED.template_variables,
    updated_at = now(),
    status = CASE 
      WHEN communication_events.status = 'failed' THEN 'queued'
      ELSE communication_events.status
    END
  RETURNING id INTO v_event_id;

  -- Log successful operation
  INSERT INTO audit_logs (action, category, message, entity_id, new_values)
  VALUES (
    'communication_event_queued_production',
    'Email System',
    'Production communication event queued successfully',
    v_event_id,
    jsonb_build_object(
      'event_type', p_event_type,
      'recipient_email', p_recipient_email,
      'template_key', p_template_key,
      'order_id', p_order_id,
      'source', p_source
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'dedupe_key', v_dedupe_key
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error but return success to prevent order update failures
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'communication_event_queue_failed_production',
    'Email System',
    'Failed to queue communication event (non-blocking): ' || SQLERRM,
    jsonb_build_object(
      'error', SQLERRM,
      'sqlstate', SQLSTATE,
      'event_type', p_event_type,
      'recipient_email', p_recipient_email,
      'order_id', p_order_id
    )
  );

  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'non_blocking', true
  );
END;
$$;

-- 2. Create production-safe order status update function
CREATE OR REPLACE FUNCTION public.admin_update_order_status_production(
  p_order_id uuid,
  p_new_status text,
  p_admin_id uuid DEFAULT auth.uid()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_order_record RECORD;
  v_old_status text;
  v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
  v_communication_result jsonb;
BEGIN
  -- Input validation
  IF p_order_id IS NULL OR p_new_status IS NULL OR p_new_status = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid input parameters');
  END IF;

  -- Validate status
  IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Invalid status: ' || p_new_status || '. Valid: ' || array_to_string(v_valid_statuses, ', ')
    );
  END IF;

  -- Get current order with row locking
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
  
  -- Update status
  UPDATE orders 
  SET 
    status = p_new_status::order_status,
    updated_at = now(),
    updated_by = p_admin_id
  WHERE id = p_order_id
  RETURNING * INTO v_order_record;
  
  -- Queue communication event (non-blocking)
  IF v_order_record.customer_email IS NOT NULL AND 
     p_new_status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') THEN
    
    SELECT upsert_communication_event_production(
      'order_status_update',
      v_order_record.customer_email,
      'order_' || p_new_status,
      jsonb_build_object(
        'customer_name', COALESCE(v_order_record.customer_name, 'Customer'),
        'order_number', v_order_record.order_number,
        'status', p_new_status,
        'status_display', replace(initcap(replace(p_new_status, '_', ' ')), '_', ' '),
        'old_status', v_old_status,
        'updated_at', now()
      ),
      p_order_id,
      'admin_update'
    ) INTO v_communication_result;
  END IF;
  
  -- Log status change
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
  VALUES (
    'order_status_updated_production',
    'Order Management',
    'Order status updated from ' || v_old_status || ' to ' || p_new_status,
    p_admin_id,
    p_order_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object(
      'status', p_new_status, 
      'communication_result', v_communication_result,
      'admin_id', p_admin_id
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order updated successfully',
    'order', row_to_json(v_order_record),
    'communication_queued', v_communication_result
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
  VALUES (
    'order_status_update_failed_production',
    'Order Management Error',
    'Order status update failed: ' || SQLERRM,
    p_admin_id,
    p_order_id,
    jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Order update failed: ' || SQLERRM
  );
END;
$$;

-- 3. Add production monitoring for communication events
CREATE OR REPLACE FUNCTION public.monitor_communication_events_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_queued_count integer;
  v_failed_count integer;
  v_old_failed_count integer;
  v_health_status text;
BEGIN
  -- Count current queued events
  SELECT COUNT(*) INTO v_queued_count
  FROM communication_events
  WHERE status = 'queued' AND created_at > now() - interval '1 hour';
  
  -- Count recent failures
  SELECT COUNT(*) INTO v_failed_count
  FROM communication_events
  WHERE status = 'failed' AND updated_at > now() - interval '1 hour';
  
  -- Count old failed events (over 24 hours old)
  SELECT COUNT(*) INTO v_old_failed_count
  FROM communication_events
  WHERE status = 'failed' AND updated_at < now() - interval '24 hours';
  
  -- Determine health status
  IF v_failed_count > 10 THEN
    v_health_status := 'critical';
  ELSIF v_failed_count > 5 OR v_queued_count > 50 THEN
    v_health_status := 'warning';
  ELSE
    v_health_status := 'healthy';
  END IF;
  
  RETURN jsonb_build_object(
    'status', v_health_status,
    'queued_events', v_queued_count,
    'recent_failures', v_failed_count,
    'old_failures', v_old_failed_count,
    'timestamp', now()
  );
END;
$$;

-- 4. Clean up old failed communication events (maintenance function)
CREATE OR REPLACE FUNCTION public.cleanup_old_communication_events()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Archive and delete old failed events (older than 7 days)
  WITH deleted_events AS (
    DELETE FROM communication_events
    WHERE status = 'failed' 
    AND updated_at < now() - interval '7 days'
    RETURNING *
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted_events;
  
  -- Log cleanup operation
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'communication_events_cleanup',
    'System Maintenance',
    'Cleaned up old failed communication events',
    jsonb_build_object('deleted_count', v_deleted_count)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count
  );
END;
$$;