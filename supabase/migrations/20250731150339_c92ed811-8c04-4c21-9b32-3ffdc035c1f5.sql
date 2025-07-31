-- Fix any remaining functions that may not have proper search path
-- Check if there are other functions that need search path fixes

-- Ensure handle_new_user function has proper search path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_count INTEGER;
  new_user_role public.user_role;
BEGIN
  -- Lock table to prevent race condition
  LOCK TABLE public.profiles IN EXCLUSIVE MODE;

  -- Check if any admin users exist
  SELECT count(*) INTO admin_count FROM public.profiles WHERE role = 'admin';

  -- If no admins exist, make this user an admin
  IF admin_count = 0 THEN
    new_user_role := 'admin';
  ELSE
    new_user_role := 'staff';
  END IF;

  -- Insert new profile
  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', new_user_role);
  
  RETURN NEW;
END;
$function$;