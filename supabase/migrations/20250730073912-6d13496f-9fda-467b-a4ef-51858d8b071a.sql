-- Clean up duplicate business_settings records, keeping only the most recent one
WITH latest_settings AS (
  SELECT id 
  FROM business_settings 
  ORDER BY updated_at DESC 
  LIMIT 1
)
DELETE FROM business_settings 
WHERE id NOT IN (SELECT id FROM latest_settings);