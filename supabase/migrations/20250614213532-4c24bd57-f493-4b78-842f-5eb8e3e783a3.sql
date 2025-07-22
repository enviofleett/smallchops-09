
-- Create an enum type for user roles to match your application's types
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'staff');

-- Create a table for public user profiles
-- This table will store user data that is safe to be publicly accessible
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT,
  role user_role NOT NULL DEFAULT 'staff',
  avatar_url TEXT
);

-- Set up Row Level Security (RLS) for the profiles table.
-- This is a security measure to ensure users can only access their own data.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles table
-- 1. Allow users to view their own profile
CREATE POLICY "Users can view their own profile."
ON public.profiles FOR SELECT
USING ( auth.uid() = id );

-- 2. Allow users to update their own profile
CREATE POLICY "Users can update their own profile."
ON public.profiles FOR UPDATE
USING ( auth.uid() = id );

-- Security definer function to get a user's role without causing recursion issues with RLS
CREATE OR REPLACE FUNCTION public.get_user_role(user_id_to_check uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
    SELECT role::text FROM profiles WHERE id = user_id_to_check;
$$;

-- 3. Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles."
ON public.profiles FOR SELECT
USING (public.get_user_role(auth.uid()) = 'admin');

-- 4. Allow admins to update all profiles
CREATE POLICY "Admins can update all profiles."
ON public.profiles FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'admin');

-- Function to create a profile for a new user upon sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (new.id, new.raw_user_meta_data->>'name', 'staff');
  RETURN new;
END;
$$;

-- Trigger the function every time a new user is created in the auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

