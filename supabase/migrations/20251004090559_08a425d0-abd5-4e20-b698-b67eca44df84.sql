-- Phase 2: Create secure user_roles table and migrate existing roles

-- 1. Create app_role enum type with all role values
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'manager', 'support_officer', 'staff');

-- 2. Create user_roles table with proper structure
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    assigned_by uuid REFERENCES auth.users(id),
    assigned_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 3. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- 5. Drop existing get_user_role function if it exists, then create new one
DROP FUNCTION IF EXISTS public.get_user_role(uuid);

CREATE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY 
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'manager' THEN 3
      WHEN 'support_officer' THEN 4
      WHEN 'staff' THEN 5
    END
  LIMIT 1
$$;

-- 6. Migrate existing roles from profiles to user_roles
-- Handle special case for toolbuxdev@gmail.com
INSERT INTO public.user_roles (user_id, role, assigned_at, is_active)
SELECT 
    p.id as user_id,
    CASE 
        WHEN u.email = 'toolbuxdev@gmail.com' THEN 'super_admin'::app_role
        WHEN p.role::text = 'admin' THEN 'admin'::app_role
        WHEN p.role::text = 'staff' THEN 'staff'::app_role
        ELSE 'staff'::app_role
    END as role,
    p.created_at as assigned_at,
    p.is_active
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 7. Create RLS policies for user_roles
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Super admins can manage user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 8. Create audit log trigger for role changes
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
    VALUES (
      'role_assigned',
      'User Management',
      'Role assigned: ' || NEW.role::text,
      NEW.assigned_by,
      NEW.user_id,
      jsonb_build_object('role', NEW.role, 'expires_at', NEW.expires_at)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
    VALUES (
      'role_updated',
      'User Management',
      'Role updated: ' || OLD.role::text || ' -> ' || NEW.role::text,
      NEW.assigned_by,
      NEW.user_id,
      jsonb_build_object('role', OLD.role, 'is_active', OLD.is_active),
      jsonb_build_object('role', NEW.role, 'is_active', NEW.is_active)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values)
    VALUES (
      'role_revoked',
      'User Management',
      'Role revoked: ' || OLD.role::text,
      auth.uid(),
      OLD.user_id,
      jsonb_build_object('role', OLD.role)
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER user_roles_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.log_role_change();

-- 9. Add indexes for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_user_roles_active ON public.user_roles(user_id, is_active) WHERE is_active = true;