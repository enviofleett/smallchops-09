-- Fix missing RPC functions for order management
CREATE OR REPLACE FUNCTION public.reassign_order_rider(p_order_id uuid, p_new_rider_id uuid, p_reason text DEFAULT 'Admin reassignment')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_old_rider_id uuid;
  v_result jsonb;
BEGIN
  -- Authorization: allow admins or service role
  IF NOT (is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Only admins or service roles can reassign riders';
  END IF;

  -- Load and validate order
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status != 'out_for_delivery' THEN
    RAISE EXCEPTION 'Order not out for delivery (status: %). Cannot reassign rider', v_order.status;
  END IF;

  -- Validate new rider
  IF NOT EXISTS (SELECT 1 FROM drivers WHERE id = p_new_rider_id AND is_active = true) THEN
    RAISE EXCEPTION 'New rider not found or not active';
  END IF;

  -- Track old assignment
  v_old_rider_id := v_order.assigned_rider_id;

  -- Update assignment in order_assignments table
  UPDATE order_assignments 
  SET rider_id = p_new_rider_id,
      assigned_by = auth.uid(),
      updated_at = NOW()
  WHERE order_id = p_order_id;

  -- Update order with new rider
  UPDATE orders
  SET assigned_rider_id = p_new_rider_id,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Audit log
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
  VALUES (
    'reassign_rider',
    'Order Management',
    p_reason,
    auth.uid(),
    p_order_id,
    jsonb_build_object('old_rider_id', v_old_rider_id),
    jsonb_build_object('new_rider_id', p_new_rider_id)
  );

  -- Return result
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

-- Clear stuck email queue and reset failed events
UPDATE communication_events 
SET status = 'queued', 
    retry_count = 0, 
    last_error = NULL,
    error_message = NULL,
    updated_at = NOW()
WHERE status = 'failed' 
  AND created_at > NOW() - INTERVAL '24 hours'
  AND retry_count < 3;

-- Delete very old failed events to prevent queue bloat
DELETE FROM communication_events 
WHERE status = 'failed' 
  AND created_at < NOW() - INTERVAL '7 days';

-- Fix any communication events missing required fields
UPDATE communication_events 
SET template_variables = COALESCE(template_variables, '{}'::jsonb)
WHERE template_variables IS NULL;

-- Add missing SMTP configuration if not present
INSERT INTO communication_settings (
  id,
  email_provider,
  sender_name,
  sender_email,
  use_smtp,
  smtp_host,
  smtp_port,
  smtp_user,
  smtp_pass,
  smtp_secure,
  production_mode,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'smtp',
  'Starters',
  'stores@startersmallchops.com',
  true,
  'smtp.gmail.com',
  587,
  'stores@startersmallchops.com',
  'EVi4fbDA18',
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;