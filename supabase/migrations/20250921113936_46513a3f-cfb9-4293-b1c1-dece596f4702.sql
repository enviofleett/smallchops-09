-- FIX: Handle null admin_id in order_audit table
-- The order_audit table doesn't allow null admin_id, but we need to handle system updates

-- First, fix the audit function to handle null admin_id
CREATE OR REPLACE FUNCTION audit_order_changes()
RETURNS TRIGGER AS $$
DECLARE
  admin_name_value TEXT;
  system_admin_id UUID;
BEGIN
  -- Get system admin ID (first admin user) as fallback
  SELECT id INTO system_admin_id 
  FROM profiles 
  WHERE role = 'admin' 
  LIMIT 1;

  -- Get admin name from profiles if available
  IF NEW.updated_by IS NOT NULL THEN
    SELECT name INTO admin_name_value 
    FROM profiles 
    WHERE id = NEW.updated_by 
    LIMIT 1;
  END IF;

  -- Only audit status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_audit (
      order_id, 
      admin_id, 
      admin_name, 
      old_status, 
      new_status, 
      action_type
    ) VALUES (
      NEW.id, 
      COALESCE(NEW.updated_by, system_admin_id),  -- Use system admin as fallback
      COALESCE(admin_name_value, 'System'),  
      OLD.status, 
      NEW.status, 
      'status_update'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;