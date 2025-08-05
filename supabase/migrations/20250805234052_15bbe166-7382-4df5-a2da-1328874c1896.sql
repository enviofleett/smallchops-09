-- Fix admin creation security vulnerabilities - Part 1: Clean up existing unsafe triggers

-- 1. First, drop the existing unsafe trigger and function CASCADE
DROP TRIGGER IF EXISTS on_auth_admin_profile ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_admin_profile() CASCADE;

-- 2. Create secure admin check function (if not exists)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid();
$$;