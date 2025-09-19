-- Phase 1: Emergency Database Fix (Simplified)
-- Step 1.1: Remove Problematic Constraint (already done in first migration)
ALTER TABLE communication_events 
DROP CONSTRAINT IF EXISTS communication_events_dedupe_enhanced;

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

-- Phase 2: Request cache for idempotency
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