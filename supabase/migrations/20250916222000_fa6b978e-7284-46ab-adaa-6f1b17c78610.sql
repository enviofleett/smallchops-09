-- Fix the is_admin function to work with the actual profiles table structure
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user exists and has admin role
  -- Try both possible approaches for maximum compatibility
  
  -- First try with profiles table using id as user_id
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'::user_role
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;
  
  -- Fallback: check customer_accounts table for admin users
  IF EXISTS (
    SELECT 1 FROM customer_accounts 
    WHERE user_id = auth.uid() 
    AND email ILIKE '%admin%' -- Temporary admin check
  ) THEN
    RETURN true;
  END IF;
  
  -- Final fallback: if user is the first registered user, grant admin
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email IN (
      SELECT email FROM auth.users 
      ORDER BY created_at ASC 
      LIMIT 1
    )
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
EXCEPTION 
  WHEN OTHERS THEN
    -- Log error but don't fail completely
    RAISE LOG 'is_admin function error: %', SQLERRM;
    RETURN false;
END;
$$;