-- Fix cascade failure: Clear stuck order processing lock
UPDATE orders 
SET processing_lock = false, 
    processing_started_at = NULL,
    processing_officer_id = NULL 
WHERE id = '55f067a8-23d7-4efb-8b08-744eea457845';

-- Fix cascade failure: Decouple email from status updates
-- Make admin_update_order_status_simple resilient to email failures
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
  v_email_error text;
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
  
  -- Update order status (ALWAYS succeeds regardless of email)
  UPDATE orders 
  SET 
    status = p_new_status::order_status,
    updated_at = now(),
    updated_by = p_admin_id
  WHERE id = p_order_id;

  -- Get updated order record
  SELECT * INTO v_order_record FROM orders WHERE id = p_order_id;

  -- Try to send email notification (fire-and-forget)
  BEGIN
    -- Log the status change first (before email attempt)
    INSERT INTO audit_logs (
      action, 
      category, 
      message, 
      user_id, 
      entity_id,
      old_values,
      new_values
    ) VALUES (
      'status_updated',
      'Order Management', 
      'Order status updated from ' || v_old_status || ' to ' || p_new_status,
      p_admin_id,
      p_order_id,
      jsonb_build_object('status', v_old_status),
      jsonb_build_object('status', p_new_status)
    );

    -- Attempt email notification (NON-BLOCKING)
    v_email_result := net.http_post(
      url := (SELECT COALESCE(current_setting('app.supabase_url', true), 'https://oknnklksdiqaifhxaccs.supabase.co')) || '/functions/v1/simple-order-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT COALESCE(current_setting('app.service_role_key', true), 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzE5MDkxNCwiZXhwIjoyMDY4NzY2OTE0fQ.Cgg_1StwRAWGrYa9a2tDzLaDW6OcCIDFl9YfhNkOTYA'))
      ),
      body := jsonb_build_object(
        'orderId', p_order_id,
        'status', p_new_status
      )
    );

    -- Log email success (if we get here)
    RAISE NOTICE 'Email notification sent successfully for order %', p_order_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Capture email error but DON'T fail the status update
    v_email_error := SQLERRM;
    RAISE WARNING 'Email notification failed for order % (status update succeeded): %', p_order_id, v_email_error;
    
    -- Log email failure for monitoring
    INSERT INTO audit_logs (
      action, 
      category, 
      message, 
      user_id, 
      entity_id,
      old_values,
      new_values
    ) VALUES (
      'email_failed',
      'Order Management', 
      'Email notification failed: ' || v_email_error,
      p_admin_id,
      p_order_id,
      jsonb_build_object('error', v_email_error),
      jsonb_build_object('attempted_status', p_new_status)
    );
  END;

  -- ALWAYS return success if status update worked
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order status updated successfully' || 
      CASE 
        WHEN v_email_error IS NOT NULL THEN ' (email notification failed)'
        ELSE ' (email notification sent)'
      END,
    'order', row_to_json(v_order_record),
    'email_status', CASE 
      WHEN v_email_error IS NOT NULL THEN 'failed'
      ELSE 'sent'
    END
  );
  
END;
$$;