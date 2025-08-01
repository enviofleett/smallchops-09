-- First, check if there are any duplicate providers and clean them up
DELETE FROM payment_integrations p1 
WHERE p1.id NOT IN (
  SELECT MIN(p2.id) 
  FROM payment_integrations p2 
  WHERE p2.provider = p1.provider
);

-- Add unique constraint on provider column to enable upsert functionality
ALTER TABLE payment_integrations 
ADD CONSTRAINT unique_provider UNIQUE (provider);