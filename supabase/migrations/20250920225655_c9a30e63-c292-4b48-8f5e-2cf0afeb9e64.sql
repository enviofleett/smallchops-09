-- Phase 1: Enhanced Database Schema for 409 Conflict Monitoring
-- Create order_update_metrics table to complement existing audit_logs
CREATE TABLE IF NOT EXISTS order_update_metrics (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    operation VARCHAR(50) NOT NULL,
    order_id UUID,
    admin_user_id UUID,
    duration_ms INTEGER,
    status VARCHAR(20) NOT NULL, -- 'success', 'error', 'retry', 'conflict'
    error_code VARCHAR(50),
    error_message TEXT,
    correlation_id VARCHAR(100),
    
    -- 409 Conflict Resolution Specific Fields
    lock_wait_time_ms INTEGER,
    retry_attempts INTEGER DEFAULT 0,
    conflict_resolution_method VARCHAR(50), -- 'retry', 'bypass', 'abort'
    concurrent_admin_sessions JSONB,
    lock_acquired BOOLEAN DEFAULT FALSE,
    cache_cleared BOOLEAN DEFAULT FALSE,
    
    -- Performance Tracking
    cache_hit BOOLEAN,
    database_query_time_ms INTEGER,
    total_processing_time_ms INTEGER
);

-- Indexes for performance monitoring queries
CREATE INDEX idx_order_metrics_timestamp ON order_update_metrics(timestamp);
CREATE INDEX idx_order_metrics_operation_status ON order_update_metrics(operation, status);
CREATE INDEX idx_order_metrics_order_id ON order_update_metrics(order_id);
CREATE INDEX idx_order_metrics_conflict_resolution ON order_update_metrics(conflict_resolution_method, timestamp);
CREATE INDEX idx_order_metrics_performance ON order_update_metrics(duration_ms, timestamp) WHERE status = 'success';

-- RLS Policy for service role and admin access
ALTER TABLE order_update_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view order metrics" ON order_update_metrics
FOR SELECT USING (is_admin());

CREATE POLICY "Service role can manage metrics" ON order_update_metrics
FOR ALL USING (auth.role() = 'service_role');

-- Function to log order update metrics automatically
CREATE OR REPLACE FUNCTION log_order_update_metric(
    p_operation TEXT,
    p_order_id UUID,
    p_admin_user_id UUID,
    p_duration_ms INTEGER,
    p_status TEXT,
    p_error_code TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_correlation_id TEXT DEFAULT NULL,
    p_lock_wait_time_ms INTEGER DEFAULT NULL,
    p_retry_attempts INTEGER DEFAULT 0,
    p_conflict_resolution_method TEXT DEFAULT NULL,
    p_concurrent_admin_sessions JSONB DEFAULT NULL,
    p_lock_acquired BOOLEAN DEFAULT FALSE,
    p_cache_cleared BOOLEAN DEFAULT FALSE,
    p_cache_hit BOOLEAN DEFAULT NULL,
    p_database_query_time_ms INTEGER DEFAULT NULL,
    p_total_processing_time_ms INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    metric_id UUID;
BEGIN
    INSERT INTO order_update_metrics (
        operation, order_id, admin_user_id, duration_ms, status, 
        error_code, error_message, correlation_id, lock_wait_time_ms,
        retry_attempts, conflict_resolution_method, concurrent_admin_sessions,
        lock_acquired, cache_cleared, cache_hit, database_query_time_ms,
        total_processing_time_ms
    ) VALUES (
        p_operation, p_order_id, p_admin_user_id, p_duration_ms, p_status,
        p_error_code, p_error_message, p_correlation_id, p_lock_wait_time_ms,
        p_retry_attempts, p_conflict_resolution_method, p_concurrent_admin_sessions,
        p_lock_acquired, p_cache_cleared, p_cache_hit, p_database_query_time_ms,
        p_total_processing_time_ms
    )
    RETURNING id INTO metric_id;
    
    RETURN metric_id;
END;
$$;

-- View for real-time conflict monitoring
CREATE OR REPLACE VIEW conflict_resolution_metrics AS
SELECT 
    DATE_TRUNC('minute', timestamp) as minute,
    COUNT(*) as total_operations,
    COUNT(CASE WHEN status = 'conflict' THEN 1 END) as conflict_count,
    COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
    AVG(duration_ms) as avg_duration_ms,
    AVG(lock_wait_time_ms) as avg_lock_wait_ms,
    AVG(retry_attempts) as avg_retry_attempts,
    ROUND(
        COUNT(CASE WHEN status = 'error' THEN 1 END)::NUMERIC / 
        NULLIF(COUNT(*), 0) * 100, 2
    ) as error_rate_percent,
    ROUND(
        COUNT(CASE WHEN status = 'conflict' THEN 1 END)::NUMERIC / 
        NULLIF(COUNT(*), 0) * 100, 2
    ) as conflict_rate_percent
FROM order_update_metrics
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('minute', timestamp)
ORDER BY minute DESC;

-- Function to get system health including conflict metrics
CREATE OR REPLACE FUNCTION get_enhanced_system_health_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_metrics JSONB;
    v_active_locks INTEGER;
    v_expired_locks INTEGER;
    v_conflict_rate NUMERIC;
    v_avg_resolution_time NUMERIC;
    v_recent_errors INTEGER;
    v_cache_success_rate NUMERIC;
BEGIN
    -- Get existing metrics from original function
    SELECT get_system_health_metrics() INTO v_metrics;
    
    -- Add conflict-specific metrics
    SELECT 
        COALESCE(AVG(CASE WHEN status = 'conflict' THEN 1.0 ELSE 0.0 END) * 100, 0),
        COALESCE(AVG(CASE WHEN conflict_resolution_method IS NOT NULL THEN duration_ms END), 0)
    INTO v_conflict_rate, v_avg_resolution_time
    FROM order_update_metrics
    WHERE timestamp > NOW() - INTERVAL '1 hour';
    
    -- Enhance the metrics with conflict data
    v_metrics := v_metrics || jsonb_build_object(
        'conflict_resolution', jsonb_build_object(
            'conflict_rate_percent', v_conflict_rate,
            'avg_resolution_time_ms', v_avg_resolution_time,
            'last_updated', NOW()
        )
    );
    
    RETURN v_metrics;
END;
$$;