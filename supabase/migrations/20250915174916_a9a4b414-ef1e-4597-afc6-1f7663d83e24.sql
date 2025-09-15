-- Fix admin_safe_update_order_status function with proper enum casting
DROP FUNCTION IF EXISTS public.admin_safe_update_order_status(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.admin_safe_update_order_status(
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
  v_old_status text;
  v_email_result jsonb;
  v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
BEGIN
  -- Validate status enum value
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
  
  v_old_status := v_order_record.status;
  
  -- Skip if status unchanged
  IF v_old_status = p_new_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Status unchanged',
      'order', row_to_json(v_order_record)
    );
  END IF;
  
  -- Update order status with explicit enum casting
  UPDATE orders 
  SET 
    status = p_new_status::order_status,
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
    'error', 'Database error: ' || SQLERRM
  );
END;
$function$;