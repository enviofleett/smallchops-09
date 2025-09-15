-- Simple fix for duplicate key error
-- Step 1: Remove problematic constraint
DROP INDEX IF EXISTS idx_communication_events_dedupe_key;

-- Step 2: Clean up duplicates
DELETE FROM communication_events 
WHERE id IN (
    SELECT id FROM (
        SELECT id, 
               ROW_NUMBER() OVER (PARTITION BY dedupe_key ORDER BY created_at DESC) as rn
        FROM communication_events
        WHERE dedupe_key IS NOT NULL
    ) t WHERE rn > 1
);