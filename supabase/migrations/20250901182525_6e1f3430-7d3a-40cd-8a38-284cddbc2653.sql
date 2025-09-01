-- Fix critical security warnings from production readiness migration

-- Fix RLS on production_readiness_status table (ensure it's properly enabled)
ALTER TABLE production_readiness_status ENABLE ROW LEVEL SECURITY;

-- Fix search_path for existing functions that need it
-- Update functions without proper search_path settings
CREATE OR REPLACE FUNCTION public.similarity(text, text)
RETURNS real
LANGUAGE c
IMMUTABLE PARALLEL SAFE STRICT
SET search_path = 'public'
AS '$libdir/pg_trgm', 'similarity';

CREATE OR REPLACE FUNCTION public.similarity_op(text, text)
RETURNS boolean
LANGUAGE c
STABLE PARALLEL SAFE STRICT
SET search_path = 'public'
AS '$libdir/pg_trgm', 'similarity_op';

CREATE OR REPLACE FUNCTION public.word_similarity(text, text)
RETURNS real
LANGUAGE c
IMMUTABLE PARALLEL SAFE STRICT
SET search_path = 'public'
AS '$libdir/pg_trgm', 'word_similarity';

CREATE OR REPLACE FUNCTION public.word_similarity_op(text, text)
RETURNS boolean
LANGUAGE c
STABLE PARALLEL SAFE STRICT
SET search_path = 'public'
AS '$libdir/pg_trgm', 'word_similarity_op';

CREATE OR REPLACE FUNCTION public.word_similarity_commutator_op(text, text)
RETURNS boolean
LANGUAGE c
STABLE PARALLEL SAFE STRICT
SET search_path = 'public'
AS '$libdir/pg_trgm', 'word_similarity_commutator_op';

-- Update validate_phone_number function with proper search_path
CREATE OR REPLACE FUNCTION public.validate_phone_number(phone_text text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Basic international phone number validation
    -- Accepts formats like +1234567890, +12 345 678 9012, etc.
    RETURN phone_text ~ '^\+[1-9]\d{1,14}$' OR phone_text ~ '^\+[1-9][\d\s\-\(\)]{7,20}$';
END;
$$;

-- Update set_updated_at function with proper search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Log the security fixes
INSERT INTO audit_logs (
  action,
  category,
  message,
  user_id,
  new_values,
  event_time
) VALUES (
  'security_warnings_fixed',
  'Security',
  'Fixed critical security warnings from production readiness migration',
  auth.uid(),
  jsonb_build_object(
    'fixed_issues', ARRAY[
      'RLS enabled on production_readiness_status',
      'search_path fixed for similarity functions',
      'search_path fixed for validation functions'
    ],
    'migration_context', 'production_readiness_implementation'
  ),
  NOW()
);