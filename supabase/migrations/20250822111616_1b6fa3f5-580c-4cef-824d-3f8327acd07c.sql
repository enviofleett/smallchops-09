-- Fix the generate_guest_session_id function to be more robust
CREATE OR REPLACE FUNCTION public.generate_guest_session_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Use gen_random_uuid() instead of gen_random_bytes for better compatibility
  RETURN 'guest_' || replace(gen_random_uuid()::text, '-', '');
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback to timestamp-based ID if gen_random_uuid fails
    RETURN 'guest_' || extract(epoch from now())::bigint::text || '_' || floor(random() * 1000000)::text;
END;
$function$;