-- FIX: Remove broken trigger that references updated_by_name
-- The audit_order_changes() function is trying to access updated_by_name which doesn't exist

-- Drop the problematic trigger and function
DROP TRIGGER IF EXISTS audit_order_changes_trigger ON orders;
DROP FUNCTION IF EXISTS audit_order_changes();

-- Create corrected audit function that doesn't reference updated_by_name
CREATE OR REPLACE FUNCTION audit_order_changes()
RETURNS TRIGGER AS $$
DECLARE
  admin_name_value TEXT;
BEGIN
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
      order_id, admin_id, admin_name, old_status, new_status, action_type
    ) VALUES (
      NEW.id, 
      NEW.updated_by, 
      COALESCE(admin_name_value, 'System'),  -- Use fetched name or fallback
      OLD.status, 
      NEW.status, 
      'status_update'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER audit_order_changes_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION audit_order_changes();