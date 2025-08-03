-- Create trigger to automatically create customer accounts when users sign up
CREATE OR REPLACE FUNCTION public.handle_new_customer_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_name TEXT;
  user_email TEXT;
BEGIN
  -- Extract user details from auth.users
  user_email := NEW.email;
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name', 
    split_part(NEW.email, '@', 1)
  );

  -- Create customer account record
  INSERT INTO public.customer_accounts (
    user_id, 
    name, 
    phone, 
    email_verified,
    phone_verified,
    profile_completion_percentage
  ) VALUES (
    NEW.id,
    user_name,
    NEW.raw_user_meta_data->>'phone',
    NEW.email_confirmed_at IS NOT NULL,
    false,
    CASE 
      WHEN NEW.raw_user_meta_data->>'phone' IS NOT NULL THEN 80 
      ELSE 60 
    END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    email_verified = EXCLUDED.email_verified,
    profile_completion_percentage = EXCLUDED.profile_completion_percentage,
    updated_at = NOW();

  -- Also create/update customers table entry for compatibility
  INSERT INTO public.customers (
    user_id,
    name,
    email,
    phone,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    user_name,
    user_email,
    NEW.raw_user_meta_data->>'phone',
    NOW(),
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    updated_at = NOW()
  WHERE customers.user_id IS NULL; -- Only update if not already linked

  RETURN NEW;
END;
$$;

-- Create trigger for new user registrations
DROP TRIGGER IF EXISTS on_auth_customer_user_created ON auth.users;
CREATE TRIGGER on_auth_customer_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer_user();

-- Create trigger for user updates (email confirmation, etc.)
DROP TRIGGER IF EXISTS on_auth_customer_user_updated ON auth.users;
CREATE TRIGGER on_auth_customer_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer_user();