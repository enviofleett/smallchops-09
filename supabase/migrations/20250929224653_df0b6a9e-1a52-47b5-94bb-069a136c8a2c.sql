-- Create helper function to validate JSONB
CREATE OR REPLACE FUNCTION is_jsonb_valid(input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  PERFORM input::jsonb;
  RETURN TRUE;
EXCEPTION WHEN others THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION is_jsonb_valid(TEXT) IS 
  'Validates if a text string can be parsed as valid JSONB';

-- Fix invalid delivery_address in orders
UPDATE orders
SET delivery_address = '{}'::jsonb
WHERE delivery_address IS NOT NULL 
  AND NOT is_jsonb_valid(delivery_address::text);

-- Fix invalid product features
UPDATE products
SET features = '[]'::jsonb
WHERE features IS NOT NULL 
  AND NOT is_jsonb_valid(features::text);

-- Fix invalid product ingredients
UPDATE products
SET ingredients = '[]'::jsonb
WHERE ingredients IS NOT NULL 
  AND NOT is_jsonb_valid(ingredients::text);

-- Log the cleanup
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'json_cleanup_migration',
  'Data Integrity',
  'Cleaned up invalid JSON data during migration',
  jsonb_build_object(
    'tables_affected', ARRAY['orders', 'products'],
    'timestamp', now()
  )
);