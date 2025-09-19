-- Phase 1: Emergency Database Fix
-- Step 1.1: Remove Problematic Constraint
ALTER TABLE communication_events 
DROP CONSTRAINT IF EXISTS communication_events_dedupe_enhanced;

-- Step 1.2: Implement Business Logic Constraint (without CONCURRENTLY)
-- Only ONE status update event per order per minute (reasonable business rule)
CREATE UNIQUE INDEX IF NOT EXISTS comm_events_order_status_window 
ON communication_events (order_id, event_type, DATE_TRUNC('minute', created_at))
WHERE event_type = 'order_status_update';

-- Step 1.4: Add Distributed Locking Infrastructure
CREATE TABLE IF NOT EXISTS order_update_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  lock_key text NOT NULL UNIQUE,
  acquired_by text NOT NULL, -- admin session ID
  acquired_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 seconds'),
  released_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for lock management
CREATE INDEX IF NOT EXISTS idx_order_update_locks_expiry ON order_update_locks (expires_at) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_order_update_locks_order ON order_update_locks (order_id, expires_at);