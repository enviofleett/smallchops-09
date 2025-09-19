-- Phase 4: Database Schema Updates - Fix NULL values and change acquired_by to UUID

-- First, clean up NULL acquired_by records (these are invalid locks)
DELETE FROM order_update_locks WHERE acquired_by IS NULL;

-- Clean up expired locks
UPDATE order_update_locks 
SET released_at = now()
WHERE expires_at < now() AND released_at IS NULL;

-- Update existing session-string records to use admin user IDs where possible
-- For now, just clean up any non-UUID strings since we can't reliably map them
DELETE FROM order_update_locks 
WHERE acquired_by IS NOT NULL 
  AND acquired_by !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Now safely change column type from text to UUID
ALTER TABLE order_update_locks 
ALTER COLUMN acquired_by TYPE UUID USING acquired_by::UUID;

-- Update the acquire_order_lock function to work with UUID
CREATE OR REPLACE FUNCTION public.acquire_order_lock(p_order_id uuid, p_admin_user_id uuid, p_timeout_seconds integer DEFAULT 30)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    p_admin_user_id,
    now() + (p_timeout_seconds || ' seconds')::interval
  )
  ON CONFLICT (lock_key) DO NOTHING
  RETURNING true INTO lock_acquired;
  
  RETURN COALESCE(lock_acquired, false);
END;
$function$;

-- Update the release_order_lock function to work with UUID
CREATE OR REPLACE FUNCTION public.release_order_lock(p_order_id uuid, p_admin_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE order_update_locks 
  SET released_at = now()
  WHERE order_id = p_order_id 
    AND acquired_by = p_admin_user_id 
    AND released_at IS NULL;
  
  RETURN FOUND;
END;
$function$;

-- Update get_order_lock_info function to properly join with profiles
CREATE OR REPLACE FUNCTION public.get_order_lock_info(p_order_id uuid)
 RETURNS TABLE(is_locked boolean, locking_admin_id uuid, locking_admin_name text, locking_admin_avatar text, locking_admin_email text, lock_expires_at timestamp with time zone, seconds_remaining integer, acquired_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN oul.id IS NOT NULL THEN true ELSE false END as is_locked,
    oul.acquired_by as locking_admin_id,
    p.name as locking_admin_name,
    p.avatar_url as locking_admin_avatar,
    p.email as locking_admin_email,
    oul.expires_at as lock_expires_at,
    GREATEST(0, EXTRACT(EPOCH FROM (oul.expires_at - now()))::integer) as seconds_remaining,
    oul.acquired_at as acquired_at
  FROM order_update_locks oul
  LEFT JOIN profiles p ON p.id = oul.acquired_by
  WHERE oul.order_id = p_order_id 
    AND oul.released_at IS NULL 
    AND oul.expires_at > now()
  ORDER BY oul.acquired_at DESC
  LIMIT 1;
END;
$function$;

-- Add performance index
CREATE INDEX IF NOT EXISTS idx_order_update_locks_order_admin 
ON order_update_locks (order_id, acquired_by);