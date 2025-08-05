-- Fix admin creation security vulnerabilities - Part 2: Implement secure admin creation

-- 1. Create secure admin profile creation function (invitation-based only)
CREATE OR REPLACE FUNCTION public.handle_admin_invitation_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  invitation_record RECORD;
  user_name TEXT;
BEGIN
  -- Only handle users with invitation metadata
  IF NEW.raw_user_meta_data->>'invitation_id' IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verify the invitation exists and is valid
  SELECT * INTO invitation_record
  FROM public.admin_invitations 
  WHERE id = (NEW.raw_user_meta_data->>'invitation_id')::uuid
    AND email = NEW.email
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired admin invitation';
  END IF;

  -- Extract name safely
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Create admin profile
  INSERT INTO public.profiles (id, name, email, role, status)
  VALUES (
    NEW.id,
    user_name,
    NEW.email,
    invitation_record.role::user_role,
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    updated_at = NOW();

  -- Log admin profile creation
  INSERT INTO public.audit_logs (
    action, category, message, new_values, user_id
  ) VALUES (
    'secure_admin_profile_created',
    'Authentication',
    'Admin profile created via secure invitation: ' || NEW.email,
    jsonb_build_object(
      'profile_id', NEW.id,
      'role', invitation_record.role,
      'invitation_id', invitation_record.id
    ),
    NEW.id
  );

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Log errors but don't fail user creation
    INSERT INTO public.audit_logs (
      action, category, message, new_values
    ) VALUES (
      'admin_profile_creation_error',
      'Authentication',
      'Error in secure admin profile creation: ' || SQLERRM,
      jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'error', SQLERRM,
        'invitation_id', NEW.raw_user_meta_data->>'invitation_id'
      )
    );
    
    -- Return NEW to allow user creation to proceed
    RETURN NEW;
END;
$$;

-- 2. Create the secure trigger
CREATE TRIGGER on_admin_invitation_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_admin_invitation_signup();

-- 3. Fix RLS policies to prevent infinite recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create secure RLS policies using the security definer function
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Admins can manage all profiles" 
ON public.profiles 
FOR ALL 
USING (public.is_admin())
WITH CHECK (public.is_admin());