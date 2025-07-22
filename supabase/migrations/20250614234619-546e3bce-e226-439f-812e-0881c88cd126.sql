
-- Update the existing handle_new_user function to automatically make chudesyl@gmail.com an admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Check if this is the admin email and set role accordingly
  IF NEW.email = 'chudesyl@gmail.com' THEN
    INSERT INTO public.profiles (id, name, role)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'Admin User'), 'admin');
  ELSE
    INSERT INTO public.profiles (id, name, role)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'name', 'staff');
  END IF;
  
  RETURN NEW;
END;
$$;
