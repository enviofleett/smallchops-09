-- Fix admin creation security vulnerabilities

-- 1. Create secure admin check function  
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. Replace dangerous admin profile trigger with secure invitation-based system
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_admin_profile();

-- 3. Create secure admin profile creation function (invitation-based only)
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

-- 4. Create the secure trigger
CREATE TRIGGER on_admin_invitation_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_admin_invitation_signup();

-- 5. Fix RLS policies to prevent infinite recursion
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

-- 6. Ensure admin_invitations security
CREATE POLICY "Service can manage invitations during signup" 
ON public.admin_invitations 
FOR SELECT 
USING (auth.role() = 'service_role' OR public.is_admin());

-- 7. Add rate limiting for admin creation
CREATE OR REPLACE FUNCTION public.check_admin_creation_rate_limit()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Allow max 5 admin invitations per hour per admin
  SELECT COUNT(*) INTO recent_count
  FROM public.admin_invitations
  WHERE invited_by = auth.uid()
    AND invited_at > NOW() - INTERVAL '1 hour';
    
  RETURN recent_count < 5;
END;
$$;

-- 8. Add invitation validation trigger
CREATE OR REPLACE FUNCTION public.validate_admin_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
BEGIN
  -- Check rate limit
  IF NOT public.check_admin_creation_rate_limit() THEN
    RAISE EXCEPTION 'Admin invitation rate limit exceeded. Maximum 5 invitations per hour.';
  END IF;

  -- Ensure only admins can create invitations
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can send admin invitations';
  END IF;

  -- Generate secure token
  NEW.invitation_token := encode(gen_random_bytes(32), 'base64');
  
  -- Set expiry if not provided
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW() + INTERVAL '7 days';
  END IF;

  -- Validate email
  IF NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format for admin invitation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_admin_invitation_trigger
  BEFORE INSERT ON public.admin_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_admin_invitation();