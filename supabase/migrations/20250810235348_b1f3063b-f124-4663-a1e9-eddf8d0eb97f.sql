
-- Enable pgcrypto for cryptographically secure randomness
-- Safe to run multiple times
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Re-assert a helper that depends on pgcrypto so it compiles cleanly
CREATE OR REPLACE FUNCTION public.generate_guest_session_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RETURN 'guest_' || encode(gen_random_bytes(16), 'hex');
END;
$$;
