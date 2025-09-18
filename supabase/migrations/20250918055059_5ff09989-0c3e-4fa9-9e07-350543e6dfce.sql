-- Update business_settings with production URL
UPDATE business_settings 
SET website_url = 'https://startersmallchops.com' 
WHERE website_url IS NULL OR website_url LIKE '%lovable%';