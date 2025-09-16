-- Add the missing rate limiting functions
CREATE OR REPLACE FUNCTION check_permission_change_rate_limit(
  target_user_id uuid,
  max_changes_per_hour integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_admin_id uuid;
  recent_changes integer;
  window_start timestamp with time zone;
BEGIN
  current_admin_id := auth.uid();
  window_start := now() - interval '1 hour';
  
  -- Count recent permission changes by this admin for this user
  SELECT COALESCE(SUM(changes_count), 0) 
  INTO recent_changes
  FROM permission_change_rate_limit
  WHERE admin_user_id = current_admin_id
    AND target_user_id = check_permission_change_rate_limit.target_user_id
    AND window_start > check_permission_change_rate_limit.window_start;
  
  RETURN jsonb_build_object(
    'allowed', recent_changes < max_changes_per_hour,
    'current_count', recent_changes,
    'limit', max_changes_per_hour,
    'reset_at', now() + interval '1 hour',
    'reason', CASE 
      WHEN recent_changes >= max_changes_per_hour THEN 'rate_limit_exceeded'
      ELSE 'allowed'
    END
  );
END;
$$;

-- Function to record permission change for rate limiting
CREATE OR REPLACE FUNCTION record_permission_change_rate_limit(
  target_user_id uuid,
  changes_count integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_admin_id uuid;
BEGIN
  current_admin_id := auth.uid();
  
  INSERT INTO permission_change_rate_limit (
    admin_user_id, target_user_id, changes_count
  ) VALUES (
    current_admin_id, target_user_id, changes_count
  );
END;
$$;