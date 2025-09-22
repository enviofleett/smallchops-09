-- Function to clear all pending email events
CREATE OR REPLACE FUNCTION clear_all_pending_emails()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cleared_count INTEGER := 0;
BEGIN
  -- Delete all queued and failed communication events
  DELETE FROM communication_events 
  WHERE status IN ('queued', 'failed');
  
  GET DIAGNOSTICS cleared_count = ROW_COUNT;
  
  -- Log the cleanup
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'clear_all_pending_emails',
    'Email System Reset',
    'Cleared all pending and failed emails for system reset',
    jsonb_build_object('cleared_count', cleared_count)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'cleared_count', cleared_count,
    'message', 'All pending emails cleared successfully'
  );
END;
$$;

-- Updated order status function with simple direct email
CREATE OR REPLACE FUNCTION admin_update_order_status_simple(
  p_order_id uuid,
  p_new_status text,
  p_admin_id uuid
)
RETURNS jsonb
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
  -- Validate inputs
  IF p_new_status IS NULL OR p_new_status = 'null' OR p_new_status = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status cannot be null or empty');
  END IF;

  IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid status: ' || p_new_status
    );
  END IF;

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
      'message', 'Status unchanged',
      'order', row_to_json(v_order_record)
    );
  END IF;
  
  -- Update order status
  UPDATE orders 
  SET 
    status = p_new_status::order_status,
    updated_at = now(),
    updated_by = p_admin_id
  WHERE id = p_order_id;
  
  -- Send email for customer notification statuses
  v_email_result := jsonb_build_object('success', false, 'message', 'No email sent');
  
  IF v_order_record.customer_email IS NOT NULL AND 
     p_new_status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') THEN
    
    -- Call simple email function directly using net.http_post
    BEGIN
      SELECT net.http_post(
        url := 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/simple-order-email',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || 
                  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzE5MDkxNCwiZXhwIjoyMDY4NzY2OTE0fQ.v4aDNM_-X6PTQNdlOMHXKmyZuQAGJLHmDmOYzCx6HPo' || 
                  '"}'::jsonb,
        body := jsonb_build_object(
          'orderId', p_order_id,
          'status', p_new_status
        )
      ) INTO v_email_result;
      
      v_email_result := jsonb_build_object(
        'success', true,
        'message', 'Email sent successfully'
      );
      
    EXCEPTION WHEN OTHERS THEN
      v_email_result := jsonb_build_object(
        'success', false,
        'error', 'Email sending failed: ' || SQLERRM
      );
    END;
  END IF;
  
  -- Get updated order
  SELECT * INTO v_order_record FROM orders WHERE id = p_order_id;
  
  -- Log the update
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
  VALUES (
    'admin_order_status_updated_simple',
    'Order Management',
    'Simple order status update: ' || v_old_status || ' → ' || p_new_status,
    p_admin_id,
    p_order_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object(
      'status', p_new_status,
      'email_result', v_email_result
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order updated with simple email notification',
    'order', row_to_json(v_order_record),
    'email_result', v_email_result,
    'old_status', v_old_status,
    'new_status', p_new_status
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Update failed: ' || SQLERRM
  );
END;
$$;