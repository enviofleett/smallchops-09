
-- This migration updates the database function that handles new user creation.
-- It removes the old logic that checked for a specific hardcoded email address.
-- Instead, it will automatically make the first user who signs up an administrator.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
  new_user_role public.user_role;
BEGIN
  -- Use a lock to prevent a race condition if two users sign up at the exact same time.
  LOCK TABLE public.profiles IN EXCLUSIVE MODE;

  -- Check if any admin users already exist in the profiles table.
  SELECT count(*) INTO admin_count FROM public.profiles WHERE role = 'admin';

  -- If no admins exist, this new user becomes an admin.
  -- Otherwise, they are assigned the default 'staff' role.
  IF admin_count = 0 THEN
    new_user_role := 'admin';
  ELSE
    new_user_role := 'staff';
  END IF;

  -- Insert a new row into the public.profiles table for the new user.
  INSERT INTO public.profiles (id, name, role)
  VALUES (new.id, new.raw_user_meta_data->>'name', new_user_role);
  
  RETURN new;
END;
$$;
