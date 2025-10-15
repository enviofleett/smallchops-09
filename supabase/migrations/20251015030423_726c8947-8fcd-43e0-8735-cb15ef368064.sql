-- PERMANENT FIX: Clean up duplicates first, then add unique constraint

-- Step 1: Delete duplicate communication_events, keeping only the most recent one per dedupe_key
DELETE FROM communication_events
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (PARTITION BY dedupe_key ORDER BY created_at DESC) as rn
        FROM communication_events
        WHERE dedupe_key IS NOT NULL
    ) t
    WHERE t.rn > 1
);

-- Step 2: Clean up any NULL dedupe_keys
UPDATE communication_events 
SET dedupe_key = gen_random_uuid()::text || '_' || event_type || '_' || COALESCE(order_id::text, 'no_order') || '_' || id::text
WHERE dedupe_key IS NULL;

-- Step 3: Create unique index on dedupe_key (allows ON CONFLICT to work)
CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_events_dedupe_key 
ON communication_events(dedupe_key);

-- Step 4: Make dedupe_key NOT NULL going forward (with default value)
ALTER TABLE communication_events 
ALTER COLUMN dedupe_key SET DEFAULT gen_random_uuid()::text,
ALTER COLUMN dedupe_key SET NOT NULL;

-- Log the fix
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
    'communication_events_dedupe_fixed_permanently',
    'Email System',
    'Removed duplicate events, added unique constraint on dedupe_key to permanently prevent email spam',
    jsonb_build_object(
        'duplicates_removed', true,
        'constraint_added', 'idx_communication_events_dedupe_key',
        'fix_type', 'permanent'
    )
);