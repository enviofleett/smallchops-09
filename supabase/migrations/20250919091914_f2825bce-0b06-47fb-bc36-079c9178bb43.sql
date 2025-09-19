-- CRITICAL FIX: Drop the unique INDEX causing duplicate key violations
-- Previous migration tried to drop constraint, but it's actually a unique index

-- Drop the problematic unique index that's causing production errors
DROP INDEX IF EXISTS communication_events_dedupe_flexible;

-- Ensure our enhanced composite constraint exists for proper collision handling
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'communication_events' 
        AND c.conname = 'communication_events_dedupe_enhanced'
    ) THEN
        ALTER TABLE communication_events 
        ADD CONSTRAINT communication_events_dedupe_enhanced 
        UNIQUE (dedupe_key, order_id, event_type);
    END IF;
END $$;