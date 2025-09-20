-- Fix Security Linter Issues from Phase 4 Migration (Corrected)

-- Fix any security definer views by ensuring proper RLS policies
-- Drop and recreate communication_events_health view without security definer
DROP VIEW IF EXISTS communication_events_health CASCADE;

-- Recreate as a regular view without security definer
CREATE OR REPLACE VIEW communication_events_health AS
SELECT 
  date_trunc('hour', created_at) as hour,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_events,
  COUNT(*) FILTER (WHERE collision_detected_at IS NOT NULL) as collision_events,
  COUNT(DISTINCT admin_session_id) as unique_sessions,
  AVG(retry_count) as avg_retry_count
FROM communication_events 
WHERE created_at >= now() - interval '24 hours'
GROUP BY date_trunc('hour', created_at)
ORDER BY hour DESC;

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Additional security hardening: Ensure all new functions are properly secured
-- Revoke public access and grant only to authenticated users (with full signatures)
REVOKE ALL ON FUNCTION cache_idempotent_request_enhanced(text, jsonb, jsonb, text, uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION acquire_order_lock_enhanced(uuid, uuid, integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION release_order_lock_enhanced(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_cache_batch_optimized(uuid[], integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_locks_optimized(integer) FROM PUBLIC;

-- Grant execution to authenticated users and service role
GRANT EXECUTE ON FUNCTION cache_idempotent_request_enhanced(text, jsonb, jsonb, text, uuid, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION acquire_order_lock_enhanced(uuid, uuid, integer, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION release_order_lock_enhanced(uuid, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_cache_batch_optimized(uuid[], integer, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_locks_optimized(integer) TO authenticated, service_role;

-- Ensure proper RLS on communication_events_health view
-- Since views inherit RLS from base tables, and communication_events has proper RLS, this should be secure

-- Log security hardening completion
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
    'security_hardening_phase4_corrected',
    'Security Enhancement',
    'Phase 4 security hardening completed with proper function signatures',
    jsonb_build_object(
        'functions_secured', 5,
        'permissions_granted_to', jsonb_build_array('authenticated', 'service_role'),
        'view_recreated', 'communication_events_health'
    )
);