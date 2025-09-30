-- Fix audit_order_changes function to use correct column name 'name' instead of 'display_name'

CREATE OR REPLACE FUNCTION audit_order_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  admin_name TEXT;
BEGIN
  -- Skip audit for unchanged orders
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get admin name if admin ID exists (FIX: use 'name' instead of 'display_name')
  IF NEW.updated_by IS NOT NULL THEN
    SELECT COALESCE(name, email, 'Unknown Admin') INTO admin_name
    FROM profiles 
    WHERE id = NEW.updated_by;
  ELSE
    admin_name := 'System';
  END IF;
  
  -- Insert audit record with proper system_source handling
  INSERT INTO order_audit (
    order_id, 
    admin_id, 
    admin_name, 
    old_status, 
    new_status, 
    action_type,
    system_source,
    created_at
  ) VALUES (
    NEW.id, 
    NEW.updated_by, 
    admin_name, 
    OLD.status, 
    NEW.status, 
    'status_update',
    CASE 
      WHEN NEW.updated_by IS NULL THEN 'automated_system'
      ELSE NULL 
    END,
    now()
  );
  
  RETURN NEW;
END;
$$;

-- Log the fix
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'fix_audit_order_changes_column',
  'Database Schema',
  'Fixed audit_order_changes function to use correct column name (name instead of display_name)',
  jsonb_build_object(
    'fixed_column', 'Changed display_name to name',
    'affected_function', 'audit_order_changes',
    'timestamp', now()
  )
);