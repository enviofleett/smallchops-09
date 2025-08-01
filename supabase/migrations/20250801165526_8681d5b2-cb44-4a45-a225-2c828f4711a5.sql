-- First, check if there are any duplicate providers and clean them up
-- Keep the most recent entry for each provider
DELETE FROM payment_integrations p1 
WHERE p1.ctid NOT IN (
  SELECT DISTINCT ON (provider) ctid
  FROM payment_integrations
  ORDER BY provider, created_at DESC
);

-- Add unique constraint on provider column to enable upsert functionality
ALTER TABLE payment_integrations 
ADD CONSTRAINT unique_provider UNIQUE (provider);