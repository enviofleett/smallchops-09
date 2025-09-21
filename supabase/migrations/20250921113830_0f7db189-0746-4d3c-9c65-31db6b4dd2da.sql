-- FIX: Drop all triggers and functions that reference updated_by_name with CASCADE
-- This will remove all dependent triggers, then recreate them properly

-- Drop the function with CASCADE to remove all dependent triggers
DROP FUNCTION IF EXISTS audit_order_changes() CASCADE;

-- Create corrected audit function that uses the correct field names
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

-- Recreate triggers on orders table
CREATE TRIGGER orders_audit_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION audit_order_changes();

-- Also recreate trigger on orders_new table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders_new') THEN
    CREATE TRIGGER trigger_audit_order_changes
      AFTER UPDATE ON orders_new
      FOR EACH ROW
      EXECUTE FUNCTION audit_order_changes();
  END IF;
END $$;