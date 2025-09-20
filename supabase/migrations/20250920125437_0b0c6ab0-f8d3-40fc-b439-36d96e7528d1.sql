-- Phase 4: Database Function Optimization
-- Enhanced cache management with lock-aware caching and improved concurrency

-- 4.1 Enhanced cache_idempotent_request with lock-aware caching
CREATE OR REPLACE FUNCTION public.cache_idempotent_request_enhanced(
  p_idempotency_key text,
  p_request_data jsonb,
  p_response_data jsonb DEFAULT NULL::jsonb,
  p_status text DEFAULT 'processing'::text,
  p_order_id uuid DEFAULT NULL::uuid,
  p_admin_user_id uuid DEFAULT NULL::uuid,
  p_timeout_seconds integer DEFAULT 30
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cached_result jsonb;
  lock_acquired boolean := false;
  lock_holder_info jsonb;
  cache_entry_exists boolean := false;
  processing_start_time timestamp;
BEGIN
  -- Clean up expired cache entries first (performance optimization)
  DELETE FROM request_cache WHERE expires_at < now();
  
  -- Check for existing successful cache entry (fast path)
  SELECT response_data, status = 'success' INTO cached_result, cache_entry_exists
  FROM request_cache
  WHERE idempotency_key = p_idempotency_key;
  
  IF cached_result IS NOT NULL AND cache_entry_exists THEN
    RETURN jsonb_build_object(
      'cached', true,
      'result', cached_result,
      'cache_hit', true
    );
  END IF;
  
  -- Lock management for order-specific operations
  IF p_order_id IS NOT NULL AND p_admin_user_id IS NOT NULL THEN
    -- Enhanced lock acquisition with better concurrency detection
    SELECT acquire_order_lock_enhanced(p_order_id, p_admin_user_id, p_timeout_seconds) 
    INTO lock_acquired;
    
    IF NOT lock_acquired THEN
      -- Get detailed lock holder information
      SELECT jsonb_build_object(
        'holder_id', acquired_by,
        'expires_at', expires_at,
        'seconds_remaining', GREATEST(0, EXTRACT(EPOCH FROM (expires_at - now()))::integer),
        'lock_key', lock_key
      ) INTO lock_holder_info
      FROM order_update_locks
      WHERE order_id = p_order_id 
        AND released_at IS NULL 
        AND expires_at > now()
      ORDER BY acquired_at DESC
      LIMIT 1;
      
      -- Check if current admin already holds the lock
      IF (lock_holder_info->>'holder_id')::uuid = p_admin_user_id THEN
        lock_acquired := true;
        
        -- Log lock bypass for monitoring
        INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
        VALUES (
          'lock_holder_cache_bypass_enhanced',
          'Cache Management',
          'Enhanced lock holder bypassing cache for order update',
          p_admin_user_id,
          p_order_id,
          jsonb_build_object(
            'idempotency_key', p_idempotency_key,
            'lock_info', lock_holder_info
          )
        );
      ELSE
        -- Return enhanced concurrent update error
        RETURN jsonb_build_object(
          'cached', false,
          'concurrent_update', true,
          'lock_info', lock_holder_info,
          'error', 'CONCURRENT_UPDATE_IN_PROGRESS',
          'retry_after_seconds', COALESCE((lock_holder_info->>'seconds_remaining')::integer, 30)
        );
      END IF;
    END IF;
  END IF;
  
  -- Optimized cache entry management
  processing_start_time := now();
  
  -- Insert or update cache entry with enhanced conflict resolution
  INSERT INTO request_cache (
    idempotency_key,
    request_data,
    response_data,
    status,
    processing_started_at,
    completed_at,
    expires_at
  ) VALUES (
    p_idempotency_key,
    p_request_data,
    p_response_data,
    p_status,
    processing_start_time,
    CASE WHEN p_status = 'success' THEN now() ELSE NULL END,
    now() + (COALESCE(p_timeout_seconds, 30) || ' seconds')::interval
  )
  ON CONFLICT (idempotency_key) DO UPDATE SET
    response_data = CASE 
      WHEN EXCLUDED.status = 'success' THEN EXCLUDED.response_data
      WHEN request_cache.status = 'processing' AND EXCLUDED.status = 'processing' THEN request_cache.response_data
      ELSE EXCLUDED.response_data
    END,
    status = CASE
      WHEN request_cache.status = 'success' THEN request_cache.status
      ELSE EXCLUDED.status
    END,
    completed_at = CASE 
      WHEN EXCLUDED.status = 'success' THEN now() 
      ELSE request_cache.completed_at 
    END,
    updated_at = now();
  
  RETURN jsonb_build_object(
    'cached', false,
    'result', p_response_data,
    'lock_acquired', lock_acquired,
    'processing_started', processing_start_time,
    'cache_hit', false
  );
END;
$$;

-- 4.2 Enhanced Lock Management Functions

-- Enhanced lock acquisition with renewal capabilities
CREATE OR REPLACE FUNCTION public.acquire_order_lock_enhanced(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_timeout_seconds integer DEFAULT 30,
  p_allow_renewal boolean DEFAULT true
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  lock_acquired boolean := false;
  existing_lock_holder uuid;
  lock_expires_at timestamp;
BEGIN
  -- Enhanced cleanup of expired locks with better performance
  UPDATE order_update_locks 
  SET released_at = now()
  WHERE expires_at < now() 
    AND released_at IS NULL;
  
  -- Check for existing lock
  SELECT acquired_by, expires_at INTO existing_lock_holder, lock_expires_at
  FROM order_update_locks
  WHERE order_id = p_order_id 
    AND released_at IS NULL
    AND expires_at > now()
  ORDER BY acquired_at DESC
  LIMIT 1;
  
  -- Handle lock renewal for current holder
  IF existing_lock_holder IS NOT NULL THEN
    IF existing_lock_holder = p_admin_user_id AND p_allow_renewal THEN
      -- Renew existing lock
      UPDATE order_update_locks
      SET expires_at = now() + (p_timeout_seconds || ' seconds')::interval,
          renewed_at = now(),
          renewal_count = COALESCE(renewal_count, 0) + 1
      WHERE order_id = p_order_id 
        AND acquired_by = p_admin_user_id
        AND released_at IS NULL;
      
      -- Log lock renewal
      INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
      VALUES (
        'order_lock_renewed',
        'Lock Management',
        'Order lock renewed by holder',
        p_admin_user_id,
        p_order_id,
        jsonb_build_object(
          'new_expires_at', now() + (p_timeout_seconds || ' seconds')::interval,
          'timeout_seconds', p_timeout_seconds
        )
      );
      
      RETURN true;
    ELSE
      -- Lock held by different admin
      RETURN false;
    END IF;
  END IF;
  
  -- Try to acquire new lock with enhanced conflict detection
  INSERT INTO order_update_locks (
    order_id,
    lock_key,
    acquired_by,
    expires_at,
    acquired_at,
    renewal_count
  ) VALUES (
    p_order_id,
    'order_status_update_' || p_order_id::text,
    p_admin_user_id,
    now() + (p_timeout_seconds || ' seconds')::interval,
    now(),
    0
  )
  ON CONFLICT (lock_key) DO NOTHING
  RETURNING true INTO lock_acquired;
  
  -- Log successful lock acquisition
  IF lock_acquired THEN
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
    VALUES (
      'order_lock_acquired_enhanced',
      'Lock Management',
      'Enhanced order lock acquired successfully',
      p_admin_user_id,
      p_order_id,
      jsonb_build_object(
        'timeout_seconds', p_timeout_seconds,
        'expires_at', now() + (p_timeout_seconds || ' seconds')::interval
      )
    );
  END IF;
  
  RETURN COALESCE(lock_acquired, false);
END;
$$;

-- Enhanced lock release with cleanup
CREATE OR REPLACE FUNCTION public.release_order_lock_enhanced(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_force_release boolean DEFAULT false
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  lock_released boolean := false;
  lock_info jsonb;
BEGIN
  -- Get lock information for logging
  SELECT jsonb_build_object(
    'acquired_by', acquired_by,
    'acquired_at', acquired_at,
    'expires_at', expires_at,
    'renewal_count', COALESCE(renewal_count, 0)
  ) INTO lock_info
  FROM order_update_locks
  WHERE order_id = p_order_id 
    AND released_at IS NULL;
  
  -- Release lock with proper authorization check
  UPDATE order_update_locks 
  SET released_at = now(),
      release_reason = CASE 
        WHEN p_force_release THEN 'force_release'
        ELSE 'normal_release'
      END
  WHERE order_id = p_order_id 
    AND (acquired_by = p_admin_user_id OR p_force_release = true)
    AND released_at IS NULL
  RETURNING true INTO lock_released;
  
  -- Log lock release
  IF lock_released THEN
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
    VALUES (
      'order_lock_released_enhanced',
      'Lock Management',
      CASE 
        WHEN p_force_release THEN 'Order lock force released'
        ELSE 'Order lock released normally'
      END,
      p_admin_user_id,
      p_order_id,
      jsonb_build_object(
        'force_release', p_force_release,
        'lock_info', lock_info
      )
    );
  END IF;
  
  RETURN COALESCE(lock_released, false);
END;
$$;

-- 4.3 Optimized Cache Cleanup Functions

-- Enhanced batch cache cleanup with performance optimizations
CREATE OR REPLACE FUNCTION public.cleanup_cache_batch_optimized(
  p_order_ids uuid[] DEFAULT NULL,
  p_minutes_threshold integer DEFAULT 5,
  p_batch_size integer DEFAULT 100,
  p_cleanup_type text DEFAULT 'standard'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expired_count integer := 0;
  stuck_count integer := 0;
  order_specific_count integer := 0;
  total_processed integer := 0;
  batch_start_time timestamp := now();
  cleanup_stats jsonb;
BEGIN
  -- Order-specific cleanup (highest priority)
  IF p_order_ids IS NOT NULL AND array_length(p_order_ids, 1) > 0 THEN
    DELETE FROM request_cache 
    WHERE (request_data->>'orderId')::uuid = ANY(p_order_ids)
       OR (request_data->>'order_id')::uuid = ANY(p_order_ids);
    
    GET DIAGNOSTICS order_specific_count = ROW_COUNT;
  END IF;
  
  -- Aggressive cleanup for specific transitions
  IF p_cleanup_type = 'aggressive' THEN
    -- Clean up all processing entries older than 1 minute
    DELETE FROM request_cache 
    WHERE status = 'processing'
      AND created_at < now() - interval '1 minute';
    
    GET DIAGNOSTICS stuck_count = ROW_COUNT;
    
    -- Clean up failed entries older than threshold
    DELETE FROM request_cache 
    WHERE status IN ('failed', 'error')
      AND created_at < now() - (p_minutes_threshold || ' minutes')::interval;
  ELSE
    -- Standard cleanup
    -- Clean up expired cache entries
    DELETE FROM request_cache 
    WHERE created_at < now() - (p_minutes_threshold || ' minutes')::interval
      AND status IN ('processing', 'failed')
      AND ctid IN (
        SELECT ctid FROM request_cache 
        WHERE created_at < now() - (p_minutes_threshold || ' minutes')::interval
          AND status IN ('processing', 'failed')
        LIMIT p_batch_size
      );
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Clean up stuck processing entries
    DELETE FROM request_cache 
    WHERE created_at < now() - interval '2 minutes'
      AND status = 'processing'
      AND ctid IN (
        SELECT ctid FROM request_cache 
        WHERE created_at < now() - interval '2 minutes'
          AND status = 'processing'
        LIMIT p_batch_size
      );
    
    GET DIAGNOSTICS stuck_count = ROW_COUNT;
  END IF;
  
  total_processed := expired_count + stuck_count + order_specific_count;
  
  -- Vacuum table if significant cleanup occurred
  IF total_processed > 50 THEN
    -- Note: VACUUM would require elevated privileges, so we'll log it for manual execution
    INSERT INTO audit_logs (action, category, message, new_values)
    VALUES (
      'cache_cleanup_vacuum_recommended',
      'Performance Optimization',
      'Large cache cleanup completed - VACUUM recommended',
      jsonb_build_object(
        'total_cleaned', total_processed,
        'cleanup_type', p_cleanup_type
      )
    );
  END IF;
  
  cleanup_stats := jsonb_build_object(
    'success', true,
    'expired_cleaned', expired_count,
    'stuck_cleaned', stuck_count,
    'order_specific_cleaned', order_specific_count,
    'total_cleaned', total_processed,
    'cleanup_duration_ms', EXTRACT(EPOCH FROM (now() - batch_start_time)) * 1000,
    'cleanup_type', p_cleanup_type,
    'threshold_minutes', p_minutes_threshold
  );
  
  -- Log cleanup activity with detailed stats
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'cache_cleanup_batch_optimized',
    'Cache Management',
    'Optimized batch cache cleanup completed',
    cleanup_stats
  );
  
  RETURN cleanup_stats;
END;
$$;

-- Enhanced lock cleanup with better performance
CREATE OR REPLACE FUNCTION public.cleanup_locks_optimized(
  p_force_cleanup_older_than_minutes integer DEFAULT 60
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expired_locks_count integer := 0;
  force_released_count integer := 0;
  total_cleaned integer := 0;
BEGIN
  -- Clean up expired locks
  UPDATE order_update_locks 
  SET released_at = now(),
      release_reason = 'expired_cleanup'
  WHERE expires_at < now() 
    AND released_at IS NULL
  RETURNING * INTO expired_locks_count;
  
  GET DIAGNOSTICS expired_locks_count = ROW_COUNT;
  
  -- Force cleanup of very old locks (safety mechanism)
  UPDATE order_update_locks
  SET released_at = now(),
      release_reason = 'force_cleanup_old'
  WHERE acquired_at < now() - (p_force_cleanup_older_than_minutes || ' minutes')::interval
    AND released_at IS NULL;
  
  GET DIAGNOSTICS force_released_count = ROW_COUNT;
  
  total_cleaned := expired_locks_count + force_released_count;
  
  -- Archive old lock records for analysis
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'lock_cleanup_optimized',
    'Lock Management', 
    'Optimized lock cleanup completed',
    jsonb_build_object(
      'expired_locks_cleaned', expired_locks_count,
      'force_released_count', force_released_count,
      'total_cleaned', total_cleaned,
      'force_cleanup_threshold_minutes', p_force_cleanup_older_than_minutes
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'expired_locks_cleaned', expired_locks_count,
    'force_released_count', force_released_count,
    'total_cleaned', total_cleaned
  );
END;
$$;

-- Add missing columns to order_update_locks table for enhanced functionality
ALTER TABLE order_update_locks 
ADD COLUMN IF NOT EXISTS renewed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS renewal_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS release_reason text;