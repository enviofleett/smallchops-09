-- Phase 1: Database Schema Cleanup - Remove conflicting unique constraints
-- Keep only the enhanced composite constraint for production stability

-- Drop old conflicting unique constraints if they exist
DO $$ 
BEGIN
    -- Drop old single-column dedupe_key constraints
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'communication_events_dedupe_key_unique') THEN
        ALTER TABLE communication_events DROP CONSTRAINT communication_events_dedupe_key_unique;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'communication_events_dedupe_flexible') THEN
        ALTER TABLE communication_events DROP CONSTRAINT communication_events_dedupe_flexible;
    END IF;
    
    -- Drop old indexes that might conflict
    DROP INDEX IF EXISTS idx_communication_events_dedupe_safe;
    DROP INDEX IF EXISTS idx_communication_events_dedupe_key_safe;
    DROP INDEX IF EXISTS communication_events_dedupe_key_idx;
    
EXCEPTION WHEN OTHERS THEN
    -- Log but continue if constraints don't exist
    RAISE NOTICE 'Some constraints may not exist: %', SQLERRM;
END $$;

-- Ensure our enhanced composite constraint exists and is the only one
-- This was created in previous migration but let's ensure it's correct
DO $$
BEGIN
    -- Only create if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'communication_events_dedupe_enhanced') THEN
        ALTER TABLE communication_events 
        ADD CONSTRAINT communication_events_dedupe_enhanced 
        UNIQUE (dedupe_key, order_id, event_type);
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Enhanced constraint may already exist: %', SQLERRM;
END $$;

-- Add performance index for collision monitoring queries
CREATE INDEX IF NOT EXISTS idx_communication_events_collision_monitoring 
ON communication_events (created_at DESC, status, event_type) 
WHERE status IN ('failed', 'queued');

-- Log the cleanup for audit
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
    'production_schema_cleanup',
    'Database Optimization',
    'Production fix: Cleaned up conflicting unique constraints on communication_events',
    jsonb_build_object(
        'timestamp', now(),
        'constraints_cleaned', true,
        'performance_index_added', true
    )
);