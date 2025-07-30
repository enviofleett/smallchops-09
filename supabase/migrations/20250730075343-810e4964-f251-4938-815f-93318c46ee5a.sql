-- Update business_settings with the new STARTERS logo
UPDATE business_settings 
SET logo_url = '/lovable-uploads/1d12bb7f-3e9a-436e-b3be-b7b29e055b02.png',
    updated_at = NOW()
WHERE id IN (
  SELECT id 
  FROM business_settings 
  ORDER BY updated_at DESC 
  LIMIT 1
);