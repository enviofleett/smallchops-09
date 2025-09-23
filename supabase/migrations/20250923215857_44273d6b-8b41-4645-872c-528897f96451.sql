-- DIAGNOSIS: The audit_order_changes() function tries to access NEW.updated_by_name 
-- but the orders table doesn't have this column. Only order_audit table has admin_name.

-- SOLUTION: Make the audit function defensive by deriving admin_name from updated_by
-- instead of expecting it to exist on the source table.

CREATE OR REPLACE FUNCTION public.audit_order_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  admin_name TEXT := 'System';
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    -- Defensive approach: derive admin_name from updated_by if it exists
    IF NEW.updated_by IS NOT NULL THEN
      -- First try to get display_name from profiles table
      SELECT COALESCE(p.display_name, p.full_name, au.email, 'Unknown Admin') 
      INTO admin_name
      FROM public.profiles p
      FULL OUTER JOIN auth.users au ON p.id = au.id
      WHERE p.id = NEW.updated_by OR au.id = NEW.updated_by
      LIMIT 1;
      
      -- Fallback if no profile found
      IF admin_name IS NULL THEN
        admin_name := 'Admin: ' || NEW.updated_by::text;
      END IF;
    END IF;
    
    -- Insert audit record with defensively obtained admin_name
    INSERT INTO public.order_audit (
      order_id, admin_id, admin_name, old_status, new_status, action_type
    ) VALUES (
      NEW.id, 
      NEW.updated_by, 
      admin_name, 
      OLD.status, 
      NEW.status, 
      'status_update'
    );
  END IF;
  RETURN NEW;
END;
$function$;