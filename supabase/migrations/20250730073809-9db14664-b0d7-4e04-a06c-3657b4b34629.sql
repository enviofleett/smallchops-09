-- Clean up duplicate business_settings records, keeping only the most recent one
DELETE FROM business_settings 
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY updated_at DESC) as row_num
    FROM business_settings
  ) ranked
  WHERE row_num = 1
);

-- Add unique constraint to prevent future duplicates (assuming only one business settings record should exist)
ALTER TABLE business_settings 
ADD CONSTRAINT unique_business_settings_singleton 
CHECK ((SELECT COUNT(*) FROM business_settings) <= 1);