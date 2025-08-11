-- Move pg_net extension out of public schema (if possible)
-- Note: This might not be possible in hosted Supabase, documenting as acceptable risk

-- Add a comment documenting the acceptable risk for pg_net extension
COMMENT ON EXTENSION pg_net IS 'Acceptable security risk: pg_net extension used for HTTP requests. Required for webhooks and external API calls.';

-- Create a more secure helper function for current user email check
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT COALESCE(
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    ''
  );
$$;