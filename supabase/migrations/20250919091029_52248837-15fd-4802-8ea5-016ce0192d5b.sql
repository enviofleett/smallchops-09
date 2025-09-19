-- Phase 1: Emergency Schema Cleanup - Drop conflicting unique constraint
-- Force drop the problematic communication_events_dedupe_flexible constraint
DO $$ 
BEGIN
    -- Drop the conflicting unique constraint that's causing duplicate key violations
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'communication_events_dedupe_flexible'
    ) THEN
        ALTER TABLE communication_events DROP CONSTRAINT communication_events_dedupe_flexible;
        RAISE NOTICE 'Dropped conflicting constraint: communication_events_dedupe_flexible';
    END IF;
    
    -- Ensure our enhanced composite constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'communication_events' 
        AND c.conname = 'communication_events_dedupe_enhanced'
    ) THEN
        ALTER TABLE communication_events 
        ADD CONSTRAINT communication_events_dedupe_enhanced 
        UNIQUE (dedupe_key, order_id, event_type);
        RAISE NOTICE 'Created enhanced composite constraint: communication_events_dedupe_enhanced';
    END IF;
    
    -- Add performance index for monitoring
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'communication_events' 
        AND indexname = 'idx_communication_events_collision_monitor'
    ) THEN
        CREATE INDEX idx_communication_events_collision_monitor 
        ON communication_events(created_at, status, retry_count) 
        WHERE retry_count > 0;
        RAISE NOTICE 'Created collision monitoring index';
    END IF;
END $$;