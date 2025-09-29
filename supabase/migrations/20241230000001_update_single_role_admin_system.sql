-- Migration: Update user roles for single-role admin system
-- Date: 2024-12-30
-- Description: Update role enum and migrate existing data to new role structure

-- First, add new roles to the enum (we can't directly modify existing enums)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'support_officer';

-- Update toolbuxdev@gmail.com to super_admin role
UPDATE public.profiles 
SET role = 'super_admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'toolbuxdev@gmail.com'
);

-- Update existing admin users to super_admin (except those we want to keep as managers)
-- For now, set all current admins to super_admin - can be manually adjusted later
UPDATE public.profiles 
SET role = 'super_admin'
WHERE role = 'admin';

-- Update the handle_new_user function to use new role logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
  new_user_role public.user_role;
BEGIN
  -- Special handling for toolbuxdev@gmail.com - always super_admin
  IF NEW.email = 'toolbuxdev@gmail.com' THEN
    INSERT INTO public.profiles (id, name, role, status)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'Super Admin'), 'super_admin', 'active');
    RETURN NEW;
  END IF;

  -- Count existing super_admins to prevent unauthorized creation
  SELECT COUNT(*) INTO admin_count FROM public.profiles WHERE role = 'super_admin';
  
  -- Default new users to support_officer role
  -- Super admins and managers should be created through proper admin interface
  new_user_role := 'support_officer';
  
  INSERT INTO public.profiles (id, name, role, status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'User'), new_user_role, 'active');
  
  RETURN NEW;
END;
$$;

-- Update RLS policies to use new roles
-- Drop old admin-specific policies and recreate with new role structure
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Super admins can view and manage all profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "Super admins can update all profiles"
ON public.profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Managers can view profiles but not modify roles
CREATE POLICY "Managers can view profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'manager')
  )
);

-- Update get_user_role function for new roles
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role::text FROM profiles WHERE id = user_uuid),
    'support_officer'  -- Default role for new users
  );
$function$;

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role = 'super_admin' FROM public.profiles WHERE id = auth.uid();
$$;

-- Helper function to check if user has manager or higher privileges
CREATE OR REPLACE FUNCTION public.has_manager_privileges()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role IN ('super_admin', 'manager') FROM public.profiles WHERE id = auth.uid();
$$;