-- Emergency Stabilization Phase 1: Critical Fixes
-- Fix communication_events dedupe issues and secure admin functions

-- Enable crypto extension for hash generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create improved dedupe key generation function (simplified version)
CREATE OR REPLACE FUNCTION generate_safe_dedupe_key(
  p_event_type text,
  p_recipient_email text,
  p_order_id uuid DEFAULT NULL,
  p_template_key text DEFAULT NULL
) 
RETURNS text 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dedupe_components text[];
  time_window text;
BEGIN
  -- Create time window (hour-based) to prevent spam while allowing legitimate retries
  time_window := to_char(date_trunc('hour', now()), 'YYYY-MM-DD-HH24');
  
  -- Build dedupe key components
  dedupe_components := ARRAY[
    p_event_type,
    lower(trim(p_recipient_email)),
    time_window,
    COALESCE(p_order_id::text, 'no-order'),
    COALESCE(p_template_key, 'no-template')
  ];
  
  -- Generate MD5 hash of components for consistent, collision-resistant key
  RETURN md5(array_to_string(dedupe_components, '|'));
END;
$$;

-- Update existing records with proper dedupe keys (only recent ones)
UPDATE communication_events 
SET dedupe_key = generate_safe_dedupe_key(
  event_type,
  recipient_email,
  order_id,
  template_key
)
WHERE dedupe_key IS NULL 
  AND created_at > now() - interval '24 hours';

-- Add trigger to automatically generate dedupe key on insert
CREATE OR REPLACE FUNCTION trigger_safe_dedupe_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only generate if not already provided
  IF NEW.dedupe_key IS NULL THEN
    NEW.dedupe_key := generate_safe_dedupe_key(
      NEW.event_type,
      NEW.recipient_email,
      NEW.order_id,
      NEW.template_key
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Replace trigger
DROP TRIGGER IF EXISTS communication_events_dedupe_key_trigger ON communication_events;
CREATE TRIGGER communication_events_dedupe_key_trigger
  BEFORE INSERT ON communication_events
  FOR EACH ROW
  EXECUTE FUNCTION trigger_safe_dedupe_key();

-- Create emergency error handler for order status updates
CREATE OR REPLACE FUNCTION emergency_safe_order_update(
  p_order_id uuid,
  p_status text,
  p_admin_id uuid DEFAULT NULL
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'];
BEGIN
  -- CRITICAL: Input validation to prevent enum violations
  IF p_status IS NULL OR p_status = '' OR p_status = 'undefined' OR p_status = 'null' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid status: cannot be null, empty, or undefined',
      'provided_status', p_status
    );
  END IF;
  
  -- Validate enum value
  IF NOT (p_status = ANY(v_valid_statuses)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid status value: ' || p_status,
      'valid_statuses', v_valid_statuses
    );
  END IF;
  
  -- Get order with row lock
  SELECT * INTO v_order
  FROM orders 
  WHERE id = p_order_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Update with explicit casting
  UPDATE orders 
  SET 
    status = p_status::order_status,
    updated_at = now(),
    updated_by = p_admin_id
  WHERE id = p_order_id
  RETURNING * INTO v_order;
  
  -- Log success
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
  VALUES (
    'emergency_order_update',
    'Order Management',
    'Emergency order status update to: ' || p_status,
    p_admin_id,
    p_order_id,
    jsonb_build_object('new_status', p_status, 'emergency_fix', true)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order updated successfully',
    'order', row_to_json(v_order)
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log error but return structured response
  INSERT INTO audit_logs (action, category, message, entity_id, new_values)
  VALUES (
    'emergency_order_update_failed',
    'Error',
    'Emergency order update failed: ' || SQLERRM,
    p_order_id,
    jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Database error: ' || SQLERRM,
    'sqlstate', SQLSTATE
  );
END;
$$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_communication_events_dedupe_key_safe 
ON communication_events (dedupe_key);

-- Fix is_admin function to be production-ready
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  user_active boolean;
BEGIN
  -- Return false if no authenticated user
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get the current user's role and active status
  SELECT role, is_active INTO user_role, user_active
  FROM profiles
  WHERE id = auth.uid();
  
  -- Return true if user is admin and active
  RETURN COALESCE(user_role = 'admin' AND user_active = true, false);
EXCEPTION
  WHEN OTHERS THEN
    -- Return false on any error (security-first approach)
    RETURN false;
END;
$$;