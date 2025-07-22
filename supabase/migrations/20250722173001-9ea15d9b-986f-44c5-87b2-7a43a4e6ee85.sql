
-- Clean up duplicate business_settings records, keeping only the most recent one
WITH ranked_settings AS (
  SELECT id, 
         ROW_NUMBER() OVER (ORDER BY updated_at DESC, created_at DESC) as rn
  FROM business_settings
)
DELETE FROM business_settings 
WHERE id IN (
  SELECT id FROM ranked_settings WHERE rn > 1
);

-- Update the remaining record to ensure it has the new schema structure
-- Remove any old columns that might still exist and add new social media columns
ALTER TABLE business_settings 
ADD COLUMN IF NOT EXISTS facebook_url text,
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS tiktok_url text;

-- If there's any existing social_links data, we should preserve it by migrating to individual fields
UPDATE business_settings 
SET 
  facebook_url = COALESCE(facebook_url, 
    CASE 
      WHEN social_links IS NOT NULL AND social_links ? 'facebook' 
      THEN social_links->>'facebook' 
      ELSE '' 
    END),
  instagram_url = COALESCE(instagram_url,
    CASE 
      WHEN social_links IS NOT NULL AND social_links ? 'instagram' 
      THEN social_links->>'instagram' 
      ELSE '' 
    END),
  tiktok_url = COALESCE(tiktok_url,
    CASE 
      WHEN social_links IS NOT NULL AND social_links ? 'tiktok' 
      THEN social_links->>'tiktok' 
      ELSE '' 
    END)
WHERE social_links IS NOT NULL;

-- Now remove the old social_links column
ALTER TABLE business_settings DROP COLUMN IF EXISTS social_links;
