-- Phase 1: Critical Race Condition Fix - Lock-First Approach

-- Step 1: Fix idempotency key generation and implement lock-first cache function
CREATE OR REPLACE FUNCTION public.cache_idempotent_request_lock_first(
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
SET search_path TO 'public'
AS $function$
DECLARE
  cached_result jsonb;
  lock_acquired boolean := false;
  lock_holder_id uuid;
BEGIN
  -- Clean up expired cache entries first
  DELETE FROM request_cache WHERE expires_at < now();
  
  -- CRITICAL FIX: Check for lock FIRST before any cache operations
  IF p_order_id IS NOT NULL AND p_admin_user_id IS NOT NULL THEN
    -- Try to acquire lock first
    SELECT acquire_order_lock(p_order_id, p_admin_user_id, 30) INTO lock_acquired;
    
    IF NOT lock_acquired THEN
      -- Check who holds the lock
      SELECT acquired_by INTO lock_holder_id
      FROM order_update_locks
      WHERE order_id = p_order_id 
        AND released_at IS NULL 
        AND expires_at > now()
      ORDER BY acquired_at DESC
      LIMIT 1;
      
      -- If current admin holds the lock, allow bypass
      IF lock_holder_id = p_admin_user_id THEN
        lock_acquired := true;
        -- Log bypass for monitoring
        INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
        VALUES (
          'lock_holder_cache_bypass',
          'Cache Management',
          'Lock holder bypassing cache for order update',
          p_admin_user_id,
          p_order_id,
          jsonb_build_object(
            'idempotency_key', p_idempotency_key,
            'lock_holder', lock_holder_id
          )
        );
      ELSE
        -- Return concurrent update error
        RETURN jsonb_build_object(
          'cached', false,
          'concurrent_update', true,
          'lock_holder_id', lock_holder_id,
          'error', 'CONCURRENT_UPDATE_IN_PROGRESS'
        );
      END IF;
    END IF;
  END IF;
  
  -- ONLY proceed with cache operations if we have the lock or it's not required
  
  -- Try to get existing successful cache entry
  SELECT response_data INTO cached_result
  FROM request_cache
  WHERE idempotency_key = p_idempotency_key
    AND status = 'success';
  
  IF cached_result IS NOT NULL THEN
    -- Release lock if we acquired it (since we have cached result)
    IF lock_acquired AND p_order_id IS NOT NULL AND p_admin_user_id IS NOT NULL THEN
      PERFORM release_order_lock(p_order_id, p_admin_user_id);
    END IF;
    
    RETURN jsonb_build_object(
      'cached', true,
      'result', cached_result
    );
  END IF;
  
  -- Insert or update cache entry (we have the lock, so this is safe)
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
    'result', p_response_data,
    'lock_acquired', lock_acquired
  );
END;
$function$;

-- Step 2: Enhanced admin order status update with lock-first approach
CREATE OR REPLACE FUNCTION public.admin_update_order_status_lock_first(
  p_order_id uuid, 
  p_new_status text, 
  p_admin_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_order_record RECORD;
    v_old_status text;
    v_lock_acquired boolean := false;
    v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
BEGIN
    -- Validate inputs
    IF p_new_status IS NULL OR p_new_status = 'null' OR p_new_status = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Status cannot be null or empty');
    END IF;

    IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid status: ' || p_new_status || '. Valid: ' || array_to_string(v_valid_statuses, ', ')
        );
    END IF;

    -- CRITICAL: Acquire lock FIRST
    SELECT acquire_order_lock(p_order_id, p_admin_id, 30) INTO v_lock_acquired;
    
    IF NOT v_lock_acquired THEN
        -- Check who holds the lock for better error messaging
        DECLARE
            lock_holder_info RECORD;
        BEGIN
            SELECT 
                oul.acquired_by as admin_id, 
                p.name as admin_name,
                oul.expires_at,
                EXTRACT(EPOCH FROM (oul.expires_at - now()))::integer as seconds_remaining
            INTO lock_holder_info
            FROM order_update_locks oul
            LEFT JOIN profiles p ON p.id = oul.acquired_by
            WHERE oul.order_id = p_order_id 
              AND oul.released_at IS NULL 
              AND oul.expires_at > now()
            ORDER BY oul.acquired_at DESC
            LIMIT 1;
            
            RETURN jsonb_build_object(
                'success', false,
                'error', 'CONCURRENT_UPDATE_IN_PROGRESS',
                'lock_holder', jsonb_build_object(
                    'admin_id', lock_holder_info.admin_id,
                    'admin_name', lock_holder_info.admin_name,
                    'expires_at', lock_holder_info.expires_at,
                    'seconds_remaining', lock_holder_info.seconds_remaining
                )
            );
        END;
    END IF;
    
    -- Now we have the lock, proceed safely
    BEGIN
        -- Get and lock the order
        SELECT * INTO v_order_record
        FROM orders 
        WHERE id = p_order_id
        FOR UPDATE;
        
        IF NOT FOUND THEN
            PERFORM release_order_lock(p_order_id, p_admin_id);
            RETURN jsonb_build_object('success', false, 'error', 'Order not found');
        END IF;
        
        v_old_status := v_order_record.status::text;
        
        -- Skip if unchanged
        IF v_old_status = p_new_status THEN
            PERFORM release_order_lock(p_order_id, p_admin_id);
            RETURN jsonb_build_object(
                'success', true,
                'message', 'Status unchanged',
                'order', row_to_json(v_order_record)
            );
        END IF;
        
        -- Update order status atomically
        UPDATE orders 
        SET 
            status = p_new_status::order_status,
            updated_at = now(),
            updated_by = p_admin_id
        WHERE id = p_order_id;
        
        -- Queue email notification (non-blocking)
        IF v_order_record.customer_email IS NOT NULL AND 
           p_new_status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') THEN
            
            PERFORM admin_queue_order_email_enhanced(p_order_id, p_new_status);
        END IF;
        
        -- Get updated order
        SELECT * INTO v_order_record FROM orders WHERE id = p_order_id;
        
        -- Release lock
        PERFORM release_order_lock(p_order_id, p_admin_id);
        
        -- Log successful update
        INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
        VALUES (
            'admin_order_status_updated_lock_first',
            'Order Management',
            'Lock-first order status update: ' || v_old_status || ' → ' || p_new_status,
            p_admin_id,
            p_order_id,
            jsonb_build_object('status', v_old_status),
            jsonb_build_object(
                'status', p_new_status,
                'idempotency_key', p_idempotency_key,
                'lock_acquired', v_lock_acquired
            )
        );
        
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Order updated successfully',
            'order', row_to_json(v_order_record),
            'old_status', v_old_status,
            'new_status', p_new_status
        );
        
    EXCEPTION WHEN OTHERS THEN
        -- Always release lock on error
        PERFORM release_order_lock(p_order_id, p_admin_id);
        
        -- Log error
        INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
        VALUES (
            'admin_order_status_update_failed_lock_first',
            'Critical Error',
            'Lock-first order status update failed: ' || SQLERRM,
            p_admin_id,
            p_order_id,
            jsonb_build_object(
                'error', SQLERRM,
                'sqlstate', SQLSTATE,
                'old_status', v_old_status,
                'new_status', p_new_status,
                'idempotency_key', p_idempotency_key
            )
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Database error: ' || SQLERRM
        );
    END;
END;
$function$;