-- ============================================================
-- COMPREHENSIVE AUDIT LOGGING SYSTEM ENHANCEMENT
-- Production-Ready Admin Activity Tracking
-- ============================================================

-- Create function for rider assignment with audit logging
CREATE OR REPLACE FUNCTION admin_assign_rider_with_audit(
  p_order_id UUID,
  p_rider_id UUID,
  p_admin_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_old_rider RECORD;
  v_new_rider RECORD;
  v_admin RECORD;
  v_result JSONB;
BEGIN
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  -- Get old rider info if exists
  IF v_order.assigned_rider_id IS NOT NULL THEN
    SELECT * INTO v_old_rider FROM drivers WHERE id = v_order.assigned_rider_id;
  END IF;
  
  -- Get new rider info
  SELECT * INTO v_new_rider FROM drivers WHERE id = p_rider_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rider not found'
    );
  END IF;
  
  -- Get admin info
  SELECT email INTO v_admin FROM profiles WHERE id = p_admin_user_id;
  
  -- Update order with new rider
  UPDATE orders 
  SET 
    assigned_rider_id = p_rider_id,
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Log to audit_logs
  INSERT INTO audit_logs (
    user_id,
    user_name,
    action,
    category,
    entity_type,
    entity_id,
    message,
    old_values,
    new_values,
    event_time
  ) VALUES (
    p_admin_user_id,
    v_admin.email,
    CASE 
      WHEN v_order.assigned_rider_id IS NULL THEN 'rider_assigned'
      ELSE 'rider_reassigned'
    END,
    'Order Management',
    'order_rider',
    p_order_id,
    CASE 
      WHEN v_order.assigned_rider_id IS NULL THEN 
        format('Rider %s assigned to order #%s', v_new_rider.name, v_order.order_number)
      ELSE
        format('Rider changed from %s to %s for order #%s', v_old_rider.name, v_new_rider.name, v_order.order_number)
    END,
    CASE 
      WHEN v_old_rider.id IS NOT NULL THEN
        jsonb_build_object('rider_id', v_old_rider.id, 'rider_name', v_old_rider.name)
      ELSE NULL
    END,
    jsonb_build_object('rider_id', v_new_rider.id, 'rider_name', v_new_rider.name),
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'rider_id', p_rider_id,
    'rider_name', v_new_rider.name
  );
END;
$$;

-- Create function to unassign rider with audit logging
CREATE OR REPLACE FUNCTION admin_unassign_rider_with_audit(
  p_order_id UUID,
  p_admin_user_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_old_rider RECORD;
  v_admin RECORD;
BEGIN
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  -- Get old rider info
  IF v_order.assigned_rider_id IS NOT NULL THEN
    SELECT * INTO v_old_rider FROM drivers WHERE id = v_order.assigned_rider_id;
  END IF;
  
  -- Get admin info
  SELECT email INTO v_admin FROM profiles WHERE id = p_admin_user_id;
  
  -- Update order to remove rider
  UPDATE orders 
  SET 
    assigned_rider_id = NULL,
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Log to audit_logs
  INSERT INTO audit_logs (
    user_id,
    user_name,
    action,
    category,
    entity_type,
    entity_id,
    message,
    old_values,
    new_values,
    event_time
  ) VALUES (
    p_admin_user_id,
    v_admin.email,
    'rider_unassigned',
    'Order Management',
    'order_rider',
    p_order_id,
    format('Rider %s unassigned from order #%s', COALESCE(v_old_rider.name, 'Unknown'), v_order.order_number),
    CASE 
      WHEN v_old_rider.id IS NOT NULL THEN
        jsonb_build_object('rider_id', v_old_rider.id, 'rider_name', v_old_rider.name)
      ELSE NULL
    END,
    NULL,
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'action', 'unassigned'
  );
END;
$$;

-- Add performance indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id_event_time 
  ON audit_logs(entity_id, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_category_action 
  ON audit_logs(category, action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_event_time 
  ON audit_logs(user_id, event_time DESC);

-- Add index for faster order number lookups in messages
CREATE INDEX IF NOT EXISTS idx_audit_logs_message_gin 
  ON audit_logs USING gin(to_tsvector('english', message));

COMMENT ON FUNCTION admin_assign_rider_with_audit IS 'Assigns a rider to an order with comprehensive audit logging';
COMMENT ON FUNCTION admin_unassign_rider_with_audit IS 'Unassigns a rider from an order with comprehensive audit logging';