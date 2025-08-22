-- Ensure generate_guest_session_id function exists and works properly
-- This fixes the guest session generation error

-- Drop and recreate the function to ensure it exists
DROP FUNCTION IF EXISTS public.generate_guest_session_id();

CREATE OR REPLACE FUNCTION public.generate_guest_session_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Generate a secure guest session ID using built-in UUID function
  -- Prefix with 'guest_' and current timestamp for uniqueness
  RETURN 'guest_' || extract(epoch from now())::bigint || '_' || gen_random_uuid()::text;
END;
$$;

-- Grant execute permission to anon users
GRANT EXECUTE ON FUNCTION public.generate_guest_session_id() TO anon;
GRANT EXECUTE ON FUNCTION public.generate_guest_session_id() TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION public.generate_guest_session_id() IS 
'Generates a unique guest session ID for tracking guest cart sessions. Returns a string in format: guest_{timestamp}_{uuid}';
