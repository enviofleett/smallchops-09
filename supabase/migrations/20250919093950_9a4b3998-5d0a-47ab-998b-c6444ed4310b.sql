-- Phase 2: Enhanced Database Functions for Atomic Operations

-- Function to acquire distributed lock
CREATE OR REPLACE FUNCTION acquire_order_lock(
  p_order_id uuid, 
  p_admin_session_id text,
  p_timeout_seconds integer DEFAULT 30
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lock_acquired boolean := false;
BEGIN
  -- Clean up expired locks first
  UPDATE order_update_locks 
  SET released_at = now()
  WHERE expires_at < now() AND released_at IS NULL;
  
  -- Try to acquire lock
  INSERT INTO order_update_locks (
    order_id,
    lock_key,
    acquired_by,
    expires_at
  ) VALUES (
    p_order_id,
    'order_status_update_' || p_order_id::text,
    p_admin_session_id,
    now() + (p_timeout_seconds || ' seconds')::interval
  )
  ON CONFLICT (lock_key) DO NOTHING
  RETURNING true INTO lock_acquired;
  
  RETURN COALESCE(lock_acquired, false);
END;
$$;

-- Function to release distributed lock
CREATE OR REPLACE FUNCTION release_order_lock(
  p_order_id uuid,
  p_admin_session_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE order_update_locks 
  SET released_at = now()
  WHERE order_id = p_order_id 
    AND acquired_by = p_admin_session_id 
    AND released_at IS NULL;
  
  RETURN FOUND;
END;
$$;

-- Function for idempotent request caching
CREATE OR REPLACE FUNCTION cache_idempotent_request(
  p_idempotency_key text,
  p_request_data jsonb,
  p_response_data jsonb DEFAULT NULL,
  p_status text DEFAULT 'processing'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cached_result jsonb;
BEGIN
  -- Clean up expired cache entries
  DELETE FROM request_cache WHERE expires_at < now();
  
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
$$;

-- Enhanced communication event upsert with business logic
CREATE OR REPLACE FUNCTION upsert_communication_event_with_business_logic(
  p_order_id uuid,
  p_event_type text,
  p_admin_session_id text,
  p_template_key text DEFAULT NULL,
  p_template_variables jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  
SET search_path = public
AS $$
DECLARE
  existing_event_id uuid;
  new_event_id uuid;
  dedupe_key text;
  time_window_minutes integer := 2; -- Allow only one event per 2 minutes
BEGIN
  -- Generate time-window based dedupe key (2-minute window)
  dedupe_key := p_order_id::text || '_' || p_event_type || '_' || 
                DATE_TRUNC('minute', now())::text || '_' ||
                FLOOR(EXTRACT(MINUTE FROM now()) / time_window_minutes)::text;
  
  -- Check for existing event in time window
  SELECT id INTO existing_event_id
  FROM communication_events
  WHERE order_id = p_order_id
    AND event_type = p_event_type
    AND created_at > now() - (time_window_minutes || ' minutes')::interval
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF existing_event_id IS NOT NULL THEN
    -- Update existing event with new admin session info
    UPDATE communication_events 
    SET 
      admin_session_id = COALESCE(admin_session_id, p_admin_session_id),
      template_variables = COALESCE(template_variables, p_template_variables),
      updated_at = now(),
      status = CASE 
        WHEN status = 'failed' THEN 'queued'::communication_event_status
        ELSE status 
      END
    WHERE id = existing_event_id;
    
    RETURN jsonb_build_object(
      'event_id', existing_event_id,
      'created', false,
      'deduped', true,
      'window_minutes', time_window_minutes
    );
  ELSE
    -- Insert new event
    INSERT INTO communication_events (
      event_type,
      recipient_email,
      template_key,
      template_variables,
      status,
      dedupe_key,
      order_id,
      admin_session_id,
      source,
      priority,
      created_at,
      updated_at
    )
    SELECT 
      p_event_type,
      o.customer_email,
      p_template_key,
      p_template_variables || jsonb_build_object(
        'customer_name', o.customer_name,
        'order_number', o.order_number,
        'admin_session', p_admin_session_id
      ),
      'queued'::communication_event_status,
      dedupe_key,
      p_order_id,
      p_admin_session_id,
      'admin_status_update',
      'normal',
      now(),
      now()
    FROM orders o
    WHERE o.id = p_order_id
    RETURNING id INTO new_event_id;
    
    RETURN jsonb_build_object(
      'event_id', new_event_id,
      'created', true,
      'deduped', false,
      'dedupe_key', dedupe_key
    );
  END IF;
END;
$$;