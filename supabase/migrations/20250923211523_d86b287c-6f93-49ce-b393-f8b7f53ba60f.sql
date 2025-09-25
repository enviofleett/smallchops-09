-- Fix the audit_order_changes function to properly handle missing display_name column
CREATE OR REPLACE FUNCTION public.audit_order_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  admin_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    -- Get admin name from profiles table if updated_by exists
    -- First try profiles table, then fall back to auth.users email
    IF NEW.updated_by IS NOT NULL THEN
      SELECT COALESCE(display_name, full_name, email) INTO admin_name
      FROM profiles 
      WHERE id = NEW.updated_by;
      
      -- If not found in profiles, try auth.users
      IF admin_name IS NULL THEN
        SELECT COALESCE(raw_user_meta_data->>'display_name', email) INTO admin_name
        FROM auth.users 
        WHERE id = NEW.updated_by;
      END IF;
    END IF;
    
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