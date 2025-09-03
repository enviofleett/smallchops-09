
-- Fix start_delivery and reassign_order_rider to allow service_role calls (while keeping admin-only for user calls)

-- 1) start_delivery: allow service_role OR admin
CREATE OR REPLACE FUNCTION public.start_delivery(
  p_order_id uuid,
  p_rider_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Update order: assign rider then set status to out_for_delivery
  UPDATE orders
  SET assigned_rider_id = p_rider_id,
      status = 'out_for_delivery',
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
    'status', o.status,
    'assigned_rider_id', o.assigned_rider_id,
    'updated_at', o.updated_at
  )
  INTO v_result
  FROM orders o
  WHERE o.id = p_order_id;

  RETURN v_result;
END;
$$;

-- 2) reassign_order_rider: allow service_role OR admin
CREATE OR REPLACE FUNCTION public.reassign_order_rider(
  p_order_id uuid,
  p_new_rider_id uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_new_rider RECORD;
  v_old_rider_id uuid;
  v_result jsonb;
BEGIN
  -- Authorization: allow admins or service role
  IF NOT (is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Only admins or service roles can reassign riders';
  END IF;

  -- Load order
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Allow reassignment for these statuses (including out_for_delivery)
  IF v_order.status NOT IN ('confirmed','preparing','ready','out_for_delivery') THEN
    RAISE EXCEPTION 'Order not in a reassignable status (%)', v_order.status;
  END IF;

  -- Validate new rider
  SELECT * INTO v_new_rider
  FROM drivers
  WHERE id = p_new_rider_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'New rider not found or not active';
  END IF;

  v_old_rider_id := v_order.assigned_rider_id;

  -- Replace assignment row(s)
  DELETE FROM order_assignments WHERE order_id = p_order_id;
  INSERT INTO order_assignments (order_id, rider_id, assigned_by)
  VALUES (p_order_id, p_new_rider_id, auth.uid());

  -- Update order with new rider (status unchanged)
  UPDATE orders
  SET assigned_rider_id = p_new_rider_id,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Audit
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
  VALUES (
    'reassign_rider',
    'Order Management',
    COALESCE('Order rider reassigned: ' || p_reason, 'Order rider reassigned'),
    auth.uid(),
    p_order_id,
    jsonb_build_object('old_rider_id', v_old_rider_id, 'status', v_order.status),
    jsonb_build_object('new_rider_id', p_new_rider_id, 'status', v_order.status, 'reason', p_reason)
  );

  -- Return compact result
  SELECT jsonb_build_object(
    'success', true,
    'order_id', o.id,
    'status', o.status,
    'old_rider_id', v_old_rider_id,
    'new_rider_id', o.assigned_rider_id,
    'updated_at', o.updated_at
  )
  INTO v_result
  FROM orders o
  WHERE o.id = p_order_id;

  RETURN v_result;
END;
$$;
