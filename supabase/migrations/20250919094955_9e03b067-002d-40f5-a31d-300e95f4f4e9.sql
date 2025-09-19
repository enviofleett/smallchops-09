-- Create cleanup function for expired locks
CREATE OR REPLACE FUNCTION public.cleanup_expired_locks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Clean up expired locks
  UPDATE order_update_locks 
  SET released_at = now()
  WHERE expires_at < now() 
    AND released_at IS NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log cleanup activity
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'expired_locks_cleanup',
    'System Maintenance',
    'Cleaned up expired order update locks',
    jsonb_build_object('cleaned_locks', deleted_count)
  );
  
  RETURN deleted_count;
END;
$$;

-- Create enhanced monitoring functions
CREATE OR REPLACE FUNCTION public.get_system_health_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_metrics JSONB;
  v_active_locks INTEGER;
  v_expired_locks INTEGER;
  v_cache_success_rate NUMERIC;
  v_recent_errors INTEGER;
BEGIN
  -- Count active locks
  SELECT COUNT(*) INTO v_active_locks
  FROM order_update_locks
  WHERE released_at IS NULL AND expires_at > now();
  
  -- Count expired locks  
  SELECT COUNT(*) INTO v_expired_locks
  FROM order_update_locks
  WHERE released_at IS NULL AND expires_at <= now();
  
  -- Calculate cache success rate
  WITH cache_stats AS (
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful
    FROM request_cache
    WHERE created_at > now() - interval '1 hour'
  )
  SELECT 
    CASE 
      WHEN total > 0 THEN ROUND((successful::NUMERIC / total::NUMERIC) * 100, 2)
      ELSE 100
    END INTO v_cache_success_rate
  FROM cache_stats;
  
  -- Count recent errors
  SELECT COUNT(*) INTO v_recent_errors
  FROM audit_logs
  WHERE event_time > now() - interval '1 hour'
    AND (message ILIKE '%error%' OR message ILIKE '%failed%');
  
  v_metrics := jsonb_build_object(
    'active_locks', v_active_locks,
    'expired_locks', v_expired_locks,
    'cache_success_rate', v_cache_success_rate,
    'recent_errors', v_recent_errors,
    'system_status', CASE
      WHEN v_recent_errors > 10 THEN 'error'
      WHEN v_recent_errors > 5 OR v_expired_locks > 5 THEN 'degraded'
      ELSE 'healthy'
    END,
    'last_updated', now()
  );
  
  RETURN v_metrics;
END;
$$;