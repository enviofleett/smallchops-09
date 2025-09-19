-- Phase 1: Emergency Database Fix
-- Step 1.1: Remove Problematic Constraint
ALTER TABLE communication_events 
DROP CONSTRAINT IF EXISTS communication_events_dedupe_enhanced;

-- Step 1.2: Implement Business Logic Constraint
-- Only ONE status update event per order per minute (reasonable business rule)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS comm_events_order_status_window 
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

-- Phase 2: Application-Level Idempotency Infrastructure
-- Request cache for idempotency
CREATE TABLE IF NOT EXISTS request_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  request_data jsonb NOT NULL,
  response_data jsonb,
  status text NOT NULL DEFAULT 'processing', -- 'processing', 'success', 'error'
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '1 hour')
);

-- Index for cache management
CREATE INDEX IF NOT EXISTS idx_request_cache_expiry ON request_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_request_cache_status ON request_cache (status, created_at);

-- Phase 4: Enhanced Audit Logging
CREATE TABLE IF NOT EXISTS order_update_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  admin_session_id text,
  idempotency_key text,
  old_status text,
  new_status text,
  update_result text NOT NULL, -- 'success', 'no_change', 'conflict', 'error'
  error_details jsonb,
  processing_time_ms integer,
  concurrent_updates_detected boolean DEFAULT false,
  lock_wait_time_ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for monitoring and debugging
CREATE INDEX IF NOT EXISTS idx_order_update_audit_lookup ON order_update_audit (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_update_audit_conflicts ON order_update_audit (update_result, created_at) 
WHERE update_result IN ('conflict', 'error');
CREATE INDEX IF NOT EXISTS idx_order_update_audit_concurrent ON order_update_audit (concurrent_updates_detected, created_at) 
WHERE concurrent_updates_detected = true;

-- Function to clean up expired locks and cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_resources()
RETURNS void AS $$
BEGIN
  -- Release expired locks
  UPDATE order_update_locks 
  SET released_at = now()
  WHERE expires_at < now() AND released_at IS NULL;
  
  -- Clean up old cache entries
  DELETE FROM request_cache 
  WHERE expires_at < now();
  
  -- Clean up old audit logs (keep 30 days)
  DELETE FROM order_update_audit 
  WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql;