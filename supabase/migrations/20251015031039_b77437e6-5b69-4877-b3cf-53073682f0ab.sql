-- Step 1: Activate the order_out_for_delivery template
UPDATE enhanced_email_templates 
SET is_active = true 
WHERE template_key = 'order_out_for_delivery';

-- Step 2: Drop old communication event functions
DROP FUNCTION IF EXISTS admin_queue_order_email_enhanced(uuid, text);
DROP FUNCTION IF EXISTS admin_safe_update_order_status(uuid, text, uuid);
DROP FUNCTION IF EXISTS queue_communication_event_nonblocking(uuid, text, text, jsonb);

-- Step 3: Recreate admin_queue_order_email_enhanced with proper constraint handling
CREATE OR REPLACE FUNCTION admin_queue_order_email_enhanced(
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
    v_template_active BOOLEAN;
BEGIN
    -- Get order info
    SELECT o.order_number, o.total_amount, o.customer_email, o.customer_name
    INTO v_order_number, v_total_amount, v_customer_email, v_customer_name
    FROM orders o
    WHERE o.id = p_order_id;
    
    IF v_customer_email IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No customer email');
    END IF;
    
    -- Map status to template key
    v_template_key := CASE p_status
        WHEN 'confirmed' THEN 'order_confirmed'
        WHEN 'preparing' THEN 'order_preparing'
        WHEN 'ready' THEN 'order_ready'
        WHEN 'out_for_delivery' THEN 'order_out_for_delivery'
        WHEN 'delivered' THEN 'order_delivered'
        WHEN 'cancelled' THEN 'order_cancelled'
        ELSE NULL
    END;
    
    -- Validate template exists and is active
    IF v_template_key IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid status: ' || p_status);
    END IF;
    
    SELECT is_active INTO v_template_active
    FROM enhanced_email_templates
    WHERE template_key = v_template_key;
    
    IF v_template_active IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Template not found: ' || v_template_key);
    END IF;
    
    IF v_template_active = false THEN
        RETURN jsonb_build_object('success', false, 'message', 'Template inactive: ' || v_template_key);
    END IF;
    
    -- Generate unique dedupe key
    v_dedupe_key := p_order_id::TEXT || '|' || p_status || '|' || v_template_key || '|' || 
                   EXTRACT(EPOCH FROM clock_timestamp())::bigint::text || '|' ||
                   gen_random_uuid()::text;
    
    -- Insert with ON CONFLICT now that unique constraint exists
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
    
    RETURN jsonb_build_object('success', true, 'event_id', v_event_id);
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'non_blocking', true
    );
END;
$$;

-- Step 4: Recreate admin_safe_update_order_status
CREATE OR REPLACE FUNCTION admin_safe_update_order_status(
    p_order_id uuid,
    p_new_status text,
    p_admin_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_record RECORD;
  v_old_status text;
  v_email_result jsonb;
  v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
BEGIN
  -- Validate status
  IF p_new_status IS NULL OR p_new_status = 'null' OR p_new_status = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status cannot be null or empty');
  END IF;

  IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status value');
  END IF;

  -- Get current order
  SELECT * INTO v_order_record FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  v_old_status := v_order_record.status::text;
  
  -- Skip if unchanged
  IF v_old_status = p_new_status THEN
    RETURN jsonb_build_object('success', true, 'message', 'Status unchanged');
  END IF;
  
  -- Update order status
  UPDATE orders 
  SET status = p_new_status::order_status, updated_at = now(), updated_by = p_admin_id
  WHERE id = p_order_id;
  
  -- Queue email notification (non-blocking)
  IF v_order_record.customer_email IS NOT NULL AND 
     p_new_status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') THEN
    
    BEGIN
      v_email_result := admin_queue_order_email_enhanced(p_order_id, p_new_status);
    EXCEPTION WHEN OTHERS THEN
      -- Log but don't fail order update
      INSERT INTO audit_logs (action, category, message, entity_id, new_values)
      VALUES ('email_queue_failed', 'Email System', 'Failed to queue email: ' || SQLERRM, p_order_id, 
              jsonb_build_object('error', SQLERRM, 'status', p_new_status));
    END;
  END IF;
  
  -- Log status change
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
  VALUES ('order_status_updated', 'Order Management', 
          'Order status updated from ' || v_old_status || ' to ' || p_new_status,
          p_admin_id, p_order_id,
          jsonb_build_object('status', v_old_status),
          jsonb_build_object('status', p_new_status));
  
  RETURN jsonb_build_object('success', true, 'old_status', v_old_status, 'new_status', p_new_status);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;