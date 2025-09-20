-- Create enhanced cache bypass and order update function
CREATE OR REPLACE FUNCTION public.manual_cache_bypass_and_update(
  p_order_id uuid,
  p_new_status text,
  p_admin_user_id uuid,
  p_bypass_reason text DEFAULT 'manual_admin_bypass'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_record RECORD;
  v_old_status text;
  v_cache_cleared integer := 0;
  v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
BEGIN
  -- Validate inputs
  IF p_order_id IS NULL OR p_new_status IS NULL OR p_admin_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing required parameters');
  END IF;
  
  IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Invalid status: ' || p_new_status || '. Valid: ' || array_to_string(v_valid_statuses, ', ')
    );
  END IF;
  
  -- Clear all cache entries for this order (forced cleanup)
  DELETE FROM request_cache 
  WHERE request_data->>'orderId' = p_order_id::text
    OR request_data->>'order_id' = p_order_id::text;
  
  GET DIAGNOSTICS v_cache_cleared = ROW_COUNT;
  
  -- Get and lock the order
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
      'message', 'Status unchanged (no update needed)',
      'bypassed', true,
      'cache_cleared', v_cache_cleared,
      'order', row_to_json(v_order_record)
    );
  END IF;
  
  -- Update order status directly (bypassing all cache)
  UPDATE orders 
  SET 
    status = p_new_status::order_status,
    updated_at = now(),
    updated_by = p_admin_user_id
  WHERE id = p_order_id;
  
  -- Queue email notification if applicable
  IF v_order_record.customer_email IS NOT NULL AND 
     p_new_status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') THEN
    
    PERFORM admin_queue_order_email_enhanced(p_order_id, p_new_status);
  END IF;
  
  -- Get updated order
  SELECT * INTO v_order_record FROM orders WHERE id = p_order_id;
  
  -- Log the manual bypass
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
  VALUES (
    'manual_cache_bypass_order_update',
    'Admin Manual Intervention',
    'Manual cache bypass and order update: ' || v_old_status || ' → ' || p_new_status,
    p_admin_user_id,
    p_order_id,
    jsonb_build_object('status', v_old_status, 'cache_cleared', v_cache_cleared),
    jsonb_build_object(
      'status', p_new_status,
      'bypass_reason', p_bypass_reason,
      'cache_entries_cleared', v_cache_cleared
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order updated successfully via cache bypass',
    'bypassed', true,
    'cache_cleared', v_cache_cleared,
    'old_status', v_old_status,
    'new_status', p_new_status,
    'order', row_to_json(v_order_record)
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
  VALUES (
    'manual_cache_bypass_failed',
    'Admin Manual Intervention Error',
    'Manual cache bypass failed: ' || SQLERRM,
    p_admin_user_id,
    p_order_id,
    jsonb_build_object(
      'error', SQLERRM,
      'sqlstate', SQLSTATE,
      'new_status', p_new_status,
      'bypass_reason', p_bypass_reason
    )
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Cache bypass failed: ' || SQLERRM,
    'bypassed', false
  );
END;
$$;