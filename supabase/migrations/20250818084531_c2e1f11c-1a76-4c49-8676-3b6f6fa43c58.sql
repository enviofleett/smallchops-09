
-- FIX: Harden handle_new_user so it never breaks signup and only creates profiles for non-customer users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  requested_role TEXT;
  final_role user_role;
  is_customer BOOLEAN;
BEGIN
  -- Determine if this is a customer signup (default to customer when not explicitly set)
  is_customer := COALESCE(NEW.raw_user_meta_data->>'user_type', 'customer') = 'customer';

  -- For customers, don't create a profiles row. Other triggers handle customer_accounts.
  IF is_customer THEN
    RETURN NEW;
  END IF;

  -- If a profile is required (admin/staff/etc), safely map role
  requested_role := NEW.raw_user_meta_data->>'role';

  IF requested_role IN ('admin', 'manager', 'staff', 'dispatch_rider') THEN
    final_role := requested_role::user_role;
  ELSE
    final_role := 'staff'::user_role; -- safe default
  END IF;

  INSERT INTO public.profiles (id, email, role, status, created_at, updated_at)
  VALUES (NEW.id, NEW.email, final_role, 'active', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Never block signup; log and continue
    INSERT INTO public.audit_logs (
      action, category, message, user_id, new_values
    ) VALUES (
      'handle_new_user_failed_hardened',
      'Authentication',
      'Non-blocking: handle_new_user failed: ' || SQLERRM,
      NEW.id,
      jsonb_build_object(
        'email', NEW.email,
        'requested_role', requested_role
      )
    );
    RETURN NEW;
END;
$function$;
