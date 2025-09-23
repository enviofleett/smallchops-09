-- Fix the audit_order_changes trigger function to handle missing updated_by_name column
CREATE OR REPLACE FUNCTION public.audit_order_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  admin_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    -- Get admin name from profiles table if updated_by exists
    SELECT COALESCE(display_name, email) INTO admin_name
    FROM auth.users 
    WHERE id = NEW.updated_by;
    
    INSERT INTO order_audit (
      order_id, admin_id, admin_name, old_status, new_status, action_type
    ) VALUES (
      NEW.id, 
      NEW.updated_by, 
      COALESCE(admin_name, 'System'), 
      OLD.status, 
      NEW.status, 
      'status_update'
    );
  END IF;
  RETURN NEW;
END;
$function$;