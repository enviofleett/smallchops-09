-- Create function to get order lock information with admin details
CREATE OR REPLACE FUNCTION get_order_lock_info(p_order_id uuid)
RETURNS TABLE (
  is_locked boolean,
  locking_admin_id uuid,
  locking_admin_name text,  
  locking_admin_avatar text,
  locking_admin_email text,
  lock_expires_at timestamptz,
  seconds_remaining integer,
  acquired_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN oul.id IS NOT NULL THEN true ELSE false END as is_locked,
    p.id as locking_admin_id,
    p.name as locking_admin_name,
    p.avatar_url as locking_admin_avatar,
    p.email as locking_admin_email,
    oul.expires_at as lock_expires_at,
    GREATEST(0, EXTRACT(EPOCH FROM (oul.expires_at - now()))::integer) as seconds_remaining,
    oul.acquired_at as acquired_at
  FROM order_update_locks oul
  LEFT JOIN profiles p ON p.id = oul.acquired_by::uuid
  WHERE oul.order_id = p_order_id 
    AND oul.released_at IS NULL 
    AND oul.expires_at > now()
  ORDER BY oul.acquired_at DESC
  LIMIT 1;
END;
$$;