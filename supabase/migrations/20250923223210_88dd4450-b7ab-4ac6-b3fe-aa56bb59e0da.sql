-- Fix any remaining references to updated_by_name in triggers/functions
-- This ensures the audit_order_changes function is completely clean

CREATE OR REPLACE FUNCTION public.audit_order_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  admin_name TEXT := 'System';
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    -- Safely derive admin_name from updated_by (no reference to updated_by_name)
    IF NEW.updated_by IS NOT NULL THEN
      SELECT COALESCE(display_name, full_name, email, 'Admin') 
      INTO admin_name
      FROM profiles 
      WHERE id = NEW.updated_by
      LIMIT 1;
      
      -- Fallback if no profile found
      IF admin_name IS NULL OR admin_name = '' THEN
        admin_name := 'Admin ID: ' || NEW.updated_by::text;
      END IF;
    END IF;
    
    -- Insert audit record (no updated_by_name references)
    INSERT INTO order_audit (
      order_id, 
      admin_id, 
      admin_name, 
      old_status, 
      new_status, 
      action_type,
      created_at
    ) VALUES (
      NEW.id, 
      NEW.updated_by, 
      admin_name, 
      OLD.status, 
      NEW.status, 
      'status_update',
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$function$;