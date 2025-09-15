-- Phase 1: Drop and recreate functions with correct signatures
DROP FUNCTION IF EXISTS public.admin_safe_update_order_status(uuid,text,uuid);

-- Create the missing upsert_communication_event function
CREATE OR REPLACE FUNCTION public.upsert_communication_event(
  p_event_type text,
  p_recipient_email text,
  p_template_key text,
  p_template_variables jsonb DEFAULT '{}'::jsonb,
  p_order_id uuid DEFAULT NULL,
  p_dedupe_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_event_id uuid;
  v_calculated_dedupe_key text;
BEGIN
  -- Generate dedupe key if not provided
  IF p_dedupe_key IS NULL THEN
    v_calculated_dedupe_key := COALESCE(p_order_id::text, 'no-order') || '|' || 
                              p_event_type || '|' || 
                              p_template_key || '|' || 
                              FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::text;
  ELSE
    v_calculated_dedupe_key := p_dedupe_key;
  END IF;

  -- Insert or update communication event
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
    'communication_event_upserted',
    'Email System',
    'Communication event created/updated successfully',
    v_event_id,
    jsonb_build_object(
      'event_type', p_event_type,
      'recipient_email', p_recipient_email,
      'template_key', p_template_key,
      'order_id', p_order_id,
      'dedupe_key', v_calculated_dedupe_key
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'dedupe_key', v_calculated_dedupe_key
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error but return failure result instead of raising exception
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'communication_event_upsert_failed',
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
    'error', SQLERRM
  );
END;
$$;

-- Recreate admin_safe_update_order_status with proper JSONB return type
CREATE OR REPLACE FUNCTION public.admin_safe_update_order_status(
  p_order_id uuid,
  p_new_status text,
  p_admin_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_order_record RECORD;
  v_old_status text;
  v_email_result jsonb;
BEGIN
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
  
  v_old_status := v_order_record.status;
  
  -- Skip if status unchanged
  IF v_old_status = p_new_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Status unchanged',
      'order', row_to_json(v_order_record)
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
  SELECT * INTO v_order_record
  FROM orders 
  WHERE id = p_order_id;
  
  -- Queue email notification (non-blocking)
  IF v_order_record.customer_email IS NOT NULL AND 
     p_new_status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') THEN
    
    BEGIN
      SELECT upsert_communication_event(
        'order_status_update',
        v_order_record.customer_email,
        'order_status_' || p_new_status,
        jsonb_build_object(
          'customer_name', COALESCE(v_order_record.customer_name, 'Customer'),
          'order_number', v_order_record.order_number,
          'status', p_new_status,
          'total_amount', v_order_record.total_amount
        ),
        p_order_id,
        p_order_id::text || '|status_' || p_new_status || '|' || FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::text
      ) INTO v_email_result;
      
      -- Log email queuing result
      INSERT INTO audit_logs (action, category, message, entity_id, new_values)
      VALUES (
        'order_status_email_queued',
        'Email System',
        'Email notification queued for status change: ' || v_old_status || ' -> ' || p_new_status,
        p_order_id,
        jsonb_build_object(
          'email_result', v_email_result,
          'old_status', v_old_status,
          'new_status', p_new_status
        )
      );
      
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
    jsonb_build_object('status', p_new_status)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order updated successfully',
    'order', row_to_json(v_order_record)
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;