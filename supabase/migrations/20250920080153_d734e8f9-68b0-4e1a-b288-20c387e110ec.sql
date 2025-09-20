-- Fix stuck cache entries and create enhanced functions

-- First, let's clean up any stuck processing entries older than 5 minutes
UPDATE request_cache 
SET 
  status = 'failed',
  completed_at = now(),
  response_data = jsonb_build_object('error', 'Processing timeout - cleared by cleanup')
WHERE status = 'processing' 
  AND created_at < now() - interval '5 minutes';

-- Drop existing function to avoid parameter name conflicts
DROP FUNCTION IF EXISTS is_lock_holder_for_order(uuid, uuid);

-- Create enhanced functions
CREATE OR REPLACE FUNCTION public.is_lock_holder_for_order(p_order_id uuid, p_admin_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  lock_exists boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM order_update_locks 
    WHERE order_id = p_order_id 
      AND acquired_by = p_admin_user_id 
      AND released_at IS NULL 
      AND expires_at > now()
  ) INTO lock_exists;
  
  RETURN lock_exists;
END;
$function$;

-- Enhanced cache idempotent request function
CREATE OR REPLACE FUNCTION public.cache_idempotent_request_enhanced(
  p_idempotency_key text, 
  p_request_data jsonb, 
  p_response_data jsonb DEFAULT NULL::jsonb, 
  p_status text DEFAULT 'processing'::text,
  p_order_id uuid DEFAULT NULL::uuid,
  p_admin_user_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  cached_result jsonb;
  is_lock_holder boolean := false;
BEGIN
  -- Clean up expired cache entries first
  DELETE FROM request_cache WHERE expires_at < now();
  
  -- Check if admin is lock holder for this order (allows bypass)
  IF p_order_id IS NOT NULL AND p_admin_user_id IS NOT NULL THEN
    SELECT is_lock_holder_for_order(p_order_id, p_admin_user_id) INTO is_lock_holder;
  END IF;
  
  -- If user is lock holder, allow bypassing cache for new operations
  IF is_lock_holder AND p_status = 'processing' THEN
    -- Delete any existing cache entries for this operation to allow fresh processing
    DELETE FROM request_cache WHERE idempotency_key = p_idempotency_key;
    
    -- Insert new cache entry
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
    );
    
    RETURN jsonb_build_object(
      'cached', false,
      'result', p_response_data,
      'lock_holder_bypass', true
    );
  END IF;
  
  -- Try to get existing cache entry
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
  
  -- Check for processing entries that might be stuck
  IF EXISTS(
    SELECT 1 FROM request_cache 
    WHERE idempotency_key = p_idempotency_key 
      AND status = 'processing' 
      AND created_at < now() - interval '5 minutes'
  ) THEN
    -- Mark as failed and allow retry
    UPDATE request_cache 
    SET status = 'failed', completed_at = now()
    WHERE idempotency_key = p_idempotency_key AND status = 'processing';
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