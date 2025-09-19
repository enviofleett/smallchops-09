-- CRITICAL PRODUCTION FIX: Communication Events Deduplication
-- Fix duplicate key constraint violations

-- Step 1: Remove problematic duplicate constraints
ALTER TABLE communication_events DROP CONSTRAINT IF EXISTS communication_events_dedupe_key_key;
ALTER TABLE communication_events DROP CONSTRAINT IF EXISTS communication_events_dedupe_key_unique;

-- Step 2: Add enhanced composite constraint for true deduplication
ALTER TABLE communication_events ADD CONSTRAINT communication_events_dedupe_enhanced 
UNIQUE (dedupe_key, order_id, event_type) DEFERRABLE INITIALLY DEFERRED;

-- Step 3: Add collision tracking columns for monitoring
ALTER TABLE communication_events 
ADD COLUMN IF NOT EXISTS admin_session_id VARCHAR(36),
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS collision_detected_at TIMESTAMP;

-- Step 4: Create collision monitoring table
CREATE TABLE IF NOT EXISTS communication_events_collision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_dedupe_key TEXT NOT NULL,
  collision_count INTEGER DEFAULT 1,
  first_collision_at TIMESTAMP DEFAULT NOW(),
  last_collision_at TIMESTAMP DEFAULT NOW(),
  order_id UUID,
  event_type TEXT,
  admin_session_ids TEXT[],
  resolution_strategy TEXT DEFAULT 'retry_with_entropy'
);

-- Step 5: Add index for collision monitoring queries  
CREATE INDEX IF NOT EXISTS idx_comm_events_collision_monitoring 
ON communication_events (order_id, event_type, created_at);

-- Step 6: Add performance index on dedupe_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_comm_events_dedupe_key_recent 
ON communication_events (dedupe_key) 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Step 7: Create monitoring view for production dashboard
CREATE OR REPLACE VIEW communication_events_health AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE retry_count > 0) as collision_events,
  AVG(retry_count) as avg_retry_count,
  COUNT(DISTINCT admin_session_id) as unique_sessions,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_events
FROM communication_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;