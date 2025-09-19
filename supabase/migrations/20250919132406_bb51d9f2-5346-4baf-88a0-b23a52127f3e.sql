-- Phase 1 & 3: Add cache cleanup function for expired processing entries
CREATE OR REPLACE FUNCTION public.cleanup_stuck_request_cache()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cleaned_count INTEGER;
  stuck_count INTEGER;
BEGIN
  -- Clean up truly expired cache entries (older than 10 minutes)
  DELETE FROM request_cache 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  -- Mark stuck "processing" entries as failed if they're older than 5 minutes
  UPDATE request_cache 
  SET 
    status = 'failed',
    response_data = jsonb_build_object('error', 'Processing timeout - auto-cleaned'),
    completed_at = now()
  WHERE status = 'processing' 
    AND created_at < (now() - interval '5 minutes');
  
  GET DIAGNOSTICS stuck_count = ROW_COUNT;
  
  -- Log cleanup activity
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'cache_cleanup_stuck_entries',
    'System Maintenance',
    'Cleaned up stuck request cache entries',
    jsonb_build_object(
      'expired_cleaned', cleaned_count,
      'stuck_processing_fixed', stuck_count
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'expired_cleaned', cleaned_count,
    'stuck_processing_fixed', stuck_count
  );
END;
$function$;

-- Phase 2: Enhanced lock holder bypass function
CREATE OR REPLACE FUNCTION public.is_lock_holder_for_order(p_order_id uuid, p_admin_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  lock_exists boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM order_update_locks
    WHERE order_id = p_order_id
      AND acquired_by = p_admin_id
      AND released_at IS NULL
      AND expires_at > now()
  ) INTO lock_exists;
  
  RETURN lock_exists;
END;
$function$;

-- Phase 3: Enhanced cache function with lock holder bypass
CREATE OR REPLACE FUNCTION public.cache_idempotent_request_enhanced(
  p_idempotency_key text, 
  p_request_data jsonb, 
  p_response_data jsonb DEFAULT NULL::jsonb, 
  p_status text DEFAULT 'processing'::text,
  p_order_id uuid DEFAULT NULL::uuid,
  p_admin_id uuid DEFAULT NULL::uuid,
  p_bypass_cache boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cached_result jsonb;
  is_lock_holder boolean := false;
BEGIN
  -- Check if admin is lock holder for this order
  IF p_order_id IS NOT NULL AND p_admin_id IS NOT NULL THEN
    SELECT is_lock_holder_for_order(p_order_id, p_admin_id) INTO is_lock_holder;
  END IF;
  
  -- Lock holders bypass cache completely for their locked orders
  IF is_lock_holder OR p_bypass_cache THEN
    -- Still insert for audit trail but don't check for existing
    INSERT INTO request_cache (
      idempotency_key,
      request_data,
      response_data,
      status,
      completed_at
    ) VALUES (
      p_idempotency_key || '_lock_holder_' || gen_random_uuid()::text,
      p_request_data,
      p_response_data,
      p_status,
      CASE WHEN p_status = 'success' THEN now() ELSE NULL END
    );
    
    RETURN jsonb_build_object(
      'cached', false,
      'lock_holder_bypass', true,
      'result', p_response_data
    );
  END IF;
  
  -- Clean up expired cache entries first
  DELETE FROM request_cache WHERE expires_at < now();
  
  -- Mark stuck processing entries as failed (older than 5 minutes)
  UPDATE request_cache 
  SET 
    status = 'failed',
    response_data = jsonb_build_object('error', 'Processing timeout'),
    completed_at = now()
  WHERE status = 'processing' 
    AND created_at < (now() - interval '5 minutes')
    AND idempotency_key = p_idempotency_key;
  
  -- Try to get existing successful cache entry
  SELECT response_data INTO cached_result
  FROM request_cache
  WHERE idempotency_key = p_idempotency_key
    AND status = 'success';
  
  IF cached_result IS NOT NULL THEN
    RETURN jsonb_build_object(
      'cached', true,
      'result', cached_result
    );
  END IF;
  
  -- Check for existing processing entry (should be rare after cleanup above)
  IF EXISTS(
    SELECT 1 FROM request_cache 
    WHERE idempotency_key = p_idempotency_key 
      AND status = 'processing'
  ) THEN
    RETURN jsonb_build_object(
      'cached', false,
      'concurrent_processing', true,
      'message', 'Another request is currently processing this operation'
    );
  END IF;
  
  -- Insert or update cache entry
  INSERT INTO request_cache (
    idempotency_key,
    request_data,
    response_data,
    status,
    completed_at
  ) VALUES (
    p_idempotency_key,
    p_request_data,
    p_response_data,
    p_status,
    CASE WHEN p_status = 'success' THEN now() ELSE NULL END
  )
  ON CONFLICT (idempotency_key) DO UPDATE SET
    response_data = EXCLUDED.response_data,
    status = EXCLUDED.status,
    completed_at = CASE WHEN EXCLUDED.status = 'success' THEN now() ELSE request_cache.completed_at END;
  
  RETURN jsonb_build_object(
    'cached', false,
    'result', p_response_data
  );
END;
$function$;