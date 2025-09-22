-- Fix PostgreSQL function overloading conflict for create_order_with_items
-- Drop the incorrect function that has p_guest_session_id as text type
-- Keep only the function with p_guest_session_id as uuid type (matches schema)

-- Drop the conflicting function with text parameter
DROP FUNCTION IF EXISTS public.create_order_with_items(
    uuid, text, jsonb, jsonb, uuid, uuid, text, text, numeric
);

-- Clean up any other obsolete versions of the function if they exist
-- This ensures we only have one clear version that matches our schema
DROP FUNCTION IF EXISTS public.create_order_with_items(
    text, text, jsonb, jsonb, uuid, uuid, text, text, numeric
);

-- Verify the correct function signature exists (this should remain)
-- The function with p_guest_session_id uuid should be the only one left