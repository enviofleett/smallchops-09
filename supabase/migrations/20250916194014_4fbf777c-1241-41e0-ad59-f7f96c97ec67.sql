-- Fix production readiness check function - correct table references
CREATE OR REPLACE FUNCTION check_production_readiness()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
  security_check jsonb;
  rls_enabled boolean;
  admin_count integer;
  paystack_configured boolean;
  communication_configured boolean;
  recent_orders integer;
BEGIN
  -- Get security status
  SELECT check_production_security_status() INTO security_check;
  
  -- Check if RLS is enabled on critical tables
  SELECT (security_check->>'rls_enabled')::boolean INTO rls_enabled;
  
  -- Count admin users (checking customer_accounts with role in metadata or separate admin table)
  SELECT COUNT(*) INTO admin_count
  FROM customer_accounts ca
  JOIN auth.users u ON ca.user_id = u.id
  WHERE u.raw_user_meta_data->>'role' = 'admin'
     OR EXISTS (
       SELECT 1 FROM admin_invitations ai 
       WHERE ai.email = ca.email 
       AND ai.status = 'accepted'
     );
  
  -- If no admin found in customer_accounts, check for any admin invitations
  IF admin_count = 0 THEN
    SELECT COUNT(*) INTO admin_count
    FROM admin_invitations 
    WHERE status = 'accepted';
  END IF;
  
  -- Check Paystack configuration
  SELECT EXISTS (
    SELECT 1 FROM paystack_secure_config 
    WHERE is_active = true 
    AND (live_secret_key IS NOT NULL OR test_secret_key IS NOT NULL)
  ) INTO paystack_configured;
  
  -- Check communication configuration
  SELECT EXISTS (
    SELECT 1 FROM communication_settings 
    WHERE sender_email IS NOT NULL
  ) INTO communication_configured;
  
  -- Count recent orders (last 7 days)
  SELECT COUNT(*) INTO recent_orders
  FROM orders
  WHERE created_at > now() - interval '7 days';
  
  result := jsonb_build_object(
    'ready_for_production', (
      rls_enabled AND 
      admin_count > 0 AND 
      paystack_configured AND 
      communication_configured
    ),
    'score', (
      CASE WHEN rls_enabled THEN 25 ELSE 0 END +
      CASE WHEN admin_count > 0 THEN 25 ELSE 0 END +
      CASE WHEN paystack_configured THEN 25 ELSE 0 END +
      CASE WHEN communication_configured THEN 25 ELSE 0 END
    ),
    'checks', jsonb_build_object(
      'security_rls_enabled', rls_enabled,
      'admin_users_configured', admin_count > 0,
      'admin_count', admin_count,
      'paystack_configured', paystack_configured,
      'communication_configured', communication_configured,
      'has_recent_activity', recent_orders > 0
    ),
    'security_details', security_check,
    'issues', (
      CASE WHEN NOT rls_enabled THEN jsonb_build_array('RLS not enabled on critical tables') ELSE '[]'::jsonb END ||
      CASE WHEN admin_count = 0 THEN jsonb_build_array('No admin users configured') ELSE '[]'::jsonb END ||
      CASE WHEN NOT paystack_configured THEN jsonb_build_array('Paystack not configured') ELSE '[]'::jsonb END ||
      CASE WHEN NOT communication_configured THEN jsonb_build_array('Email communication not configured') ELSE '[]'::jsonb END
    ),
    'warnings', (
      CASE WHEN recent_orders = 0 THEN jsonb_build_array('No recent order activity') ELSE '[]'::jsonb END
    ),
    'last_checked', now()
  );
  
  RETURN result;
END;
$$;