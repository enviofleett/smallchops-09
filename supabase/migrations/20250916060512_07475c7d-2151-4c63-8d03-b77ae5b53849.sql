-- Fix the missing UNIQUE constraint on dedupe_key in communication_events table
-- This will resolve the "there is no unique or exclusion constraint matching the ON CONFLICT specification" error

-- First, clean up any duplicate dedupe_keys that might exist
UPDATE communication_events 
SET dedupe_key = dedupe_key || '_' || id::text 
WHERE dedupe_key IN (
  SELECT dedupe_key 
  FROM communication_events 
  WHERE dedupe_key IS NOT NULL
  GROUP BY dedupe_key 
  HAVING COUNT(*) > 1
);

-- Add the missing UNIQUE constraint on dedupe_key
ALTER TABLE communication_events 
ADD CONSTRAINT communication_events_dedupe_key_unique 
UNIQUE (dedupe_key);

-- Create an index for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_communication_events_dedupe_key 
ON communication_events (dedupe_key) 
WHERE dedupe_key IS NOT NULL;