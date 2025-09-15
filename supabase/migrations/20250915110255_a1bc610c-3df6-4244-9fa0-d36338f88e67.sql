-- Step 1: Clean existing duplicates (if any)
WITH duplicates AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY dedupe_key ORDER BY created_at DESC) as rn
    FROM communication_events
    WHERE dedupe_key IS NOT NULL
)
DELETE FROM communication_events 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Step 2: Add unique constraint on dedupe_key
ALTER TABLE communication_events 
ADD CONSTRAINT communication_events_dedupe_key_unique 
UNIQUE (dedupe_key);