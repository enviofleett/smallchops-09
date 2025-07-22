
-- Create an enum type for different menu sections in the application
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'menu_section') THEN
        CREATE TYPE public.menu_section AS ENUM (
            'dashboard',
            'orders',
            'categories',
            'products',
            'customers',
            'delivery_pickup',
            'promotions',
            'reports',
            'settings',
            'audit_logs'
        );
    END IF;
END$$;

-- Create an enum type for different permission levels
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_level') THEN
        CREATE TYPE public.permission_level AS ENUM (
            'none',
            'view',
            'edit'
        );
    END IF;
END$$;

-- Create the table to store permissions for each user and menu section
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    menu_section public.menu_section NOT NULL,
    permission_level public.permission_level NOT NULL DEFAULT 'none',
    UNIQUE(user_id, menu_section)
);

-- Enable Row-Level Security on the new table
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow admins to manage all permissions
CREATE POLICY "Admins can manage all permissions"
ON public.user_permissions
FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- Create a policy to allow users to view their own permissions
CREATE POLICY "Users can view their own permissions"
ON public.user_permissions
FOR SELECT
USING (auth.uid() = user_id);
