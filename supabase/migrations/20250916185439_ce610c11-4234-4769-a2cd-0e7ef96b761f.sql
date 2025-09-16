-- Add processing officer tracking fields to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS processing_started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS processing_officer_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS processing_officer_name text;

-- Create trigger to capture processing officer details when status changes to 'preparing'
CREATE OR REPLACE FUNCTION public.track_processing_officer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_name TEXT;
  admin_email TEXT;
BEGIN
  -- Track when order moves from 'confirmed' to 'preparing'
  IF OLD.status = 'confirmed' AND NEW.status = 'preparing' AND NEW.updated_by IS NOT NULL THEN
    -- Get admin details from customer_accounts table
    SELECT ca.name, ca.email INTO admin_name, admin_email
    FROM customer_accounts ca
    WHERE ca.user_id = NEW.updated_by
    LIMIT 1;
    
    -- If not found in customer_accounts, try auth.users metadata
    IF admin_name IS NULL THEN
      SELECT 
        COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', email),
        email
      INTO admin_name, admin_email
      FROM auth.users
      WHERE id = NEW.updated_by;
    END IF;
    
    -- Update processing officer information
    NEW.processing_started_at = NOW();
    NEW.processing_officer_id = NEW.updated_by;
    NEW.processing_officer_name = COALESCE(admin_name, 'Unknown Admin');
    
    -- Log the processing officer assignment
    INSERT INTO audit_logs (
      action, category, message, user_id, entity_id, new_values
    ) VALUES (
      'processing_officer_assigned',
      'Order Processing',
      'Processing officer assigned: ' || COALESCE(admin_name, 'Unknown Admin'),
      NEW.updated_by,
      NEW.id,
      jsonb_build_object(
        'processing_officer_id', NEW.processing_officer_id,
        'processing_officer_name', NEW.processing_officer_name,
        'processing_started_at', NEW.processing_started_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for processing officer tracking
DROP TRIGGER IF EXISTS track_processing_officer_trigger ON orders;
CREATE TRIGGER track_processing_officer_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION track_processing_officer();

-- Update existing admin_safe_update_order_status functions to ensure updated_by is always set
CREATE OR REPLACE FUNCTION public.admin_safe_update_order_status_with_officer_tracking(
  p_order_id uuid, 
  p_new_status text, 
  p_admin_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_order RECORD;
  old_status TEXT;
  admin_name TEXT;
BEGIN
  -- Verify admin permissions
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Validate inputs
  IF p_order_id IS NULL OR p_new_status IS NULL OR p_new_status = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid input parameters');
  END IF;

  -- Get current order
  SELECT * INTO result_order FROM orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  old_status := result_order.status::text;
  
  -- Skip if unchanged
  IF old_status = p_new_status THEN
    RETURN jsonb_build_object('success', true, 'message', 'Status unchanged', 'order', row_to_json(result_order));
  END IF;
  
  -- Get admin name for tracking
  SELECT ca.name INTO admin_name
  FROM customer_accounts ca
  WHERE ca.user_id = p_admin_id
  LIMIT 1;
  
  IF admin_name IS NULL THEN
    SELECT COALESCE(raw_user_meta_data->>'name', email) INTO admin_name
    FROM auth.users
    WHERE id = p_admin_id;
  END IF;
  
  -- Update order status with admin tracking
  UPDATE orders 
  SET status = p_new_status::order_status,
      updated_at = now(),
      updated_by = p_admin_id
  WHERE id = p_order_id
  RETURNING * INTO result_order;
  
  -- Log status change with admin details
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
  VALUES (
    'admin_order_status_update_tracked',
    'Order Management',
    'Order status updated from ' || old_status || ' to ' || p_new_status || ' by ' || COALESCE(admin_name, 'Unknown Admin'),
    p_admin_id,
    p_order_id,
    jsonb_build_object('status', old_status),
    jsonb_build_object(
      'status', p_new_status, 
      'admin_id', p_admin_id,
      'admin_name', admin_name
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order updated successfully', 
    'order', row_to_json(result_order),
    'admin_name', admin_name
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'Unexpected error: ' || SQLERRM);
END;
$$;