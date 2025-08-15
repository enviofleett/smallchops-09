-- ============================================================================
-- ADDITIONAL SECURITY FIXES: Resolve remaining linter warnings
-- Fix function search paths and remaining security issues
-- ============================================================================

-- 1. Fix remaining functions with mutable search paths
-- These functions need SET search_path = 'public' for security

-- Update functions that still have mutable search paths
CREATE OR REPLACE FUNCTION public.deactivate_admin_user(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  target_user RECORD;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Get target user info
  SELECT * INTO target_user FROM profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Prevent self-deactivation
  IF p_user_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Cannot deactivate yourself');
  END IF;

  -- Update user status
  UPDATE profiles
  SET is_active = false, updated_at = NOW()
  WHERE id = p_user_id;

  -- Log the action
  INSERT INTO audit_logs (
    action, category, message, user_id, entity_id, old_values, new_values
  ) VALUES (
    'admin_user_deactivated',
    'User Management',
    'Admin user deactivated: ' || target_user.email,
    auth.uid(),
    p_user_id,
    json_build_object('is_active', target_user.is_active),
    json_build_object('is_active', false)
  );

  RETURN json_build_object('success', true, 'message', 'User deactivated successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_admin_user(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  target_user RECORD;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Get target user info
  SELECT * INTO target_user FROM profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Update user status
  UPDATE profiles
  SET is_active = true, updated_at = NOW()
  WHERE id = p_user_id;

  -- Log the action
  INSERT INTO audit_logs (
    action, category, message, user_id, entity_id, old_values, new_values
  ) VALUES (
    'admin_user_activated',
    'User Management',
    'Admin user activated: ' || target_user.email,
    auth.uid(),
    p_user_id,
    json_build_object('is_active', target_user.is_active),
    json_build_object('is_active', true)
  );

  RETURN json_build_object('success', true, 'message', 'User activated successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_admin_role(p_user_id uuid, p_new_role text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  target_user RECORD;
  old_role TEXT;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Validate role
  IF p_new_role NOT IN ('admin', 'user') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid role');
  END IF;

  -- Get target user info
  SELECT * INTO target_user FROM profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  old_role := target_user.role;

  -- Update user role
  UPDATE profiles
  SET role = p_new_role, updated_at = NOW()
  WHERE id = p_user_id;

  -- Log the action
  INSERT INTO audit_logs (
    action, category, message, user_id, entity_id, old_values, new_values
  ) VALUES (
    'admin_role_updated',
    'User Management',
    'Role updated for user: ' || target_user.email || ' from ' || old_role || ' to ' || p_new_role,
    auth.uid(),
    p_user_id,
    json_build_object('role', old_role),
    json_build_object('role', p_new_role)
  );

  RETURN json_build_object('success', true, 'message', 'Role updated successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_delivery_reports(start_date date DEFAULT (CURRENT_DATE - '30 days'::interval), end_date date DEFAULT CURRENT_DATE)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  daily_analytics JSON;
  driver_performance JSON;
  zone_performance JSON;
  summary_stats JSON;
BEGIN
  -- Only allow admin access
  IF NOT is_admin() THEN
    RETURN json_build_object('error', 'Access denied');
  END IF;

  -- Get daily analytics
  SELECT json_agg(
    json_build_object(
      'date', date,
      'total_deliveries', total_deliveries,
      'completed_deliveries', completed_deliveries,
      'failed_deliveries', failed_deliveries,
      'total_delivery_fees', total_delivery_fees,
      'average_delivery_time_minutes', average_delivery_time_minutes,
      'success_rate', CASE 
        WHEN total_deliveries > 0 THEN (completed_deliveries::FLOAT / total_deliveries * 100)::NUMERIC(5,2)
        ELSE 0
      END
    )
  ) INTO daily_analytics
  FROM delivery_analytics
  WHERE date BETWEEN start_date AND end_date
  ORDER BY date DESC;

  -- Get driver performance
  SELECT json_agg(
    json_build_object(
      'driver_id', da.driver_id,
      'driver_name', d.name,
      'total_deliveries', SUM(da.deliveries_completed + da.deliveries_failed),
      'completed_deliveries', SUM(da.deliveries_completed),
      'failed_deliveries', SUM(da.deliveries_failed),
      'total_fees_collected', SUM(da.delivery_fees_collected),
      'average_delivery_time', AVG(da.total_delivery_time_minutes / NULLIF(da.deliveries_completed, 0)),
      'success_rate', CASE 
        WHEN SUM(da.deliveries_completed + da.deliveries_failed) > 0 
        THEN (SUM(da.deliveries_completed)::FLOAT / SUM(da.deliveries_completed + da.deliveries_failed) * 100)::NUMERIC(5,2)
        ELSE 0
      END
    )
  ) INTO driver_performance
  FROM driver_delivery_analytics da
  JOIN drivers d ON da.driver_id = d.id
  WHERE da.date BETWEEN start_date AND end_date
  GROUP BY da.driver_id, d.name
  ORDER BY SUM(da.deliveries_completed) DESC;

  -- Get zone performance
  SELECT json_agg(
    json_build_object(
      'zone_id', za.zone_id,
      'zone_name', dz.name,
      'total_deliveries', SUM(za.total_deliveries),
      'successful_deliveries', SUM(za.successful_deliveries),
      'total_fees', SUM(za.total_delivery_fees),
      'success_rate', CASE 
        WHEN SUM(za.total_deliveries) > 0 
        THEN (SUM(za.successful_deliveries)::FLOAT / SUM(za.total_deliveries) * 100)::NUMERIC(5,2)
        ELSE 0
      END
    )
  ) INTO zone_performance
  FROM zone_delivery_analytics za
  JOIN delivery_zones dz ON za.zone_id = dz.id
  WHERE za.date BETWEEN start_date AND end_date
  GROUP BY za.zone_id, dz.name
  ORDER BY SUM(za.successful_deliveries) DESC;

  -- Get summary statistics
  SELECT json_build_object(
    'total_revenue', COALESCE(SUM(total_delivery_fees), 0),
    'total_deliveries', COALESCE(SUM(total_deliveries), 0),
    'average_success_rate', CASE 
      WHEN SUM(total_deliveries) > 0 
      THEN (SUM(completed_deliveries)::FLOAT / SUM(total_deliveries) * 100)::NUMERIC(5,2)
      ELSE 0
    END,
    'average_delivery_time', COALESCE(AVG(average_delivery_time_minutes), 0)::NUMERIC(5,2),
    'period_start', start_date,
    'period_end', end_date
  ) INTO summary_stats
  FROM delivery_analytics
  WHERE date BETWEEN start_date AND end_date;

  RETURN json_build_object(
    'daily_analytics', COALESCE(daily_analytics, '[]'::json),
    'driver_performance', COALESCE(driver_performance, '[]'::json),
    'zone_performance', COALESCE(zone_performance, '[]'::json),
    'summary', COALESCE(summary_stats, '{}'::json)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_rider_to_order(p_order_id uuid, p_rider_id uuid, p_assigned_by uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_assignment_id UUID;
BEGIN
    -- Check if admin is making the assignment
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admins can assign riders to orders';
    END IF;
    
    -- Check if order exists and is in assignable status
    IF NOT EXISTS (
        SELECT 1 FROM orders 
        WHERE id = p_order_id 
        AND status IN ('confirmed', 'preparing', 'ready')
    ) THEN
        RAISE EXCEPTION 'Order not found or not in assignable status';
    END IF;
    
    -- Check if rider exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM drivers 
        WHERE id = p_rider_id 
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Rider not found or not active';
    END IF;
    
    -- Remove any existing assignment for this order
    DELETE FROM order_assignments WHERE order_id = p_order_id;
    
    -- Create new assignment
    INSERT INTO order_assignments (order_id, rider_id, assigned_by)
    VALUES (p_order_id, p_rider_id, p_assigned_by)
    RETURNING id INTO v_assignment_id;
    
    -- Update the order with assigned rider
    UPDATE orders 
    SET assigned_rider_id = p_rider_id,
        updated_at = now()
    WHERE id = p_order_id;
    
    -- Log the assignment action
    INSERT INTO audit_logs (
        action, category, message, user_id, entity_id, new_values
    ) VALUES (
        'rider_assigned',
        'Order Management',
        'Rider assigned to order',
        p_assigned_by,
        p_order_id,
        jsonb_build_object(
            'order_id', p_order_id,
            'rider_id', p_rider_id,
            'assignment_id', v_assignment_id
        )
    );
    
    RETURN v_assignment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_driver_with_profile(p_driver_data jsonb, p_create_profile boolean DEFAULT false, p_send_invitation boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_driver_id UUID;
    v_profile_id UUID;
    v_invitation_id UUID;
    v_email TEXT;
    v_name TEXT;
    v_result JSONB;
BEGIN
    -- Check if admin is creating the driver
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admins can create drivers';
    END IF;
    
    -- Extract email and name from driver data
    v_email := p_driver_data->>'email';
    v_name := p_driver_data->>'name';
    
    -- Validate required fields
    IF v_name IS NULL OR length(trim(v_name)) = 0 THEN
        RAISE EXCEPTION 'Driver name is required';
    END IF;
    
    -- Create driver record
    INSERT INTO drivers (
        name, phone, email, license_number, vehicle_type, 
        vehicle_brand, vehicle_model, license_plate, is_active
    ) VALUES (
        v_name,
        p_driver_data->>'phone',
        v_email,
        p_driver_data->>'license_number',
        (p_driver_data->>'vehicle_type')::vehicle_type,
        p_driver_data->>'vehicle_brand',
        p_driver_data->>'vehicle_model',
        p_driver_data->>'license_plate',
        COALESCE((p_driver_data->>'is_active')::boolean, true)
    ) RETURNING id INTO v_driver_id;
    
    v_result := jsonb_build_object(
        'driver_id', v_driver_id,
        'profile_created', false,
        'invitation_sent', false
    );
    
    -- Create invitation if email provided and requested
    IF p_send_invitation AND v_email IS NOT NULL AND length(trim(v_email)) > 0 THEN
        INSERT INTO driver_invitations (
            email, driver_data, invited_by
        ) VALUES (
            v_email, 
            p_driver_data || jsonb_build_object('driver_id', v_driver_id),
            auth.uid()
        ) RETURNING id INTO v_invitation_id;
        
        v_result := v_result || jsonb_build_object(
            'invitation_sent', true,
            'invitation_id', v_invitation_id
        );
    END IF;
    
    -- Log the action
    INSERT INTO audit_logs (
        action, category, message, user_id, entity_id, new_values
    ) VALUES (
        'driver_created_with_profile',
        'Driver Management',
        'Driver created with profile integration: ' || v_name,
        auth.uid(),
        v_driver_id,
        v_result
    );
    
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_admin_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    -- Log unauthorized access attempt
    INSERT INTO security_incidents (
      type,
      description,
      severity,
      ip_address,
      user_agent,
      created_at
    ) VALUES (
      'unauthorized_access_attempt',
      'Non-authenticated user attempted admin operation',
      'high',
      NULL, -- Will be populated by edge function
      NULL,
      NOW()
    );
    RETURN FALSE;
  END IF;
  
  SELECT * INTO v_profile
  FROM profiles
  WHERE id = v_user_id;
  
  IF NOT FOUND OR v_profile.role != 'admin' OR NOT v_profile.is_active THEN
    -- Log unauthorized access attempt
    INSERT INTO security_incidents (
      type,
      description,
      severity,
      user_id,
      created_at
    ) VALUES (
      'unauthorized_admin_access_attempt',
      'User attempted admin operation without proper permissions',
      'high',
      v_user_id,
      NOW()
    );
    RETURN FALSE;
  END IF;
  
  -- Log successful admin access validation
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id
  ) VALUES (
    'admin_access_validated',
    'Security',
    'Admin access successfully validated',
    v_user_id
  );
  
  RETURN TRUE;
END;
$$;

-- Additional functions that need search path fixing
CREATE OR REPLACE FUNCTION public.migrate_pay_to_txn_reference(pay_ref text)
RETURNS text
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  -- Extract timestamp and suffix from pay_ reference 
  -- Format: pay_1754431121034_t5cl0r3j5 -> txn_1754431121034_<new_uuid>
  IF pay_ref LIKE 'pay_%' THEN
    -- Extract the timestamp part
    DECLARE
      timestamp_part TEXT;
      new_suffix TEXT;
    BEGIN
      timestamp_part := SPLIT_PART(SUBSTRING(pay_ref FROM 5), '_', 1);
      new_suffix := gen_random_uuid()::text;
      RETURN 'txn_' || timestamp_part || '_' || new_suffix;
    END;
  END IF;
  -- If not a pay_ reference, return as is
  RETURN pay_ref;
END;
$$;

CREATE OR REPLACE FUNCTION public.hash_password(password_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- This will be handled in edge functions with proper bcrypt
  -- This function serves as a placeholder for validation
  IF LENGTH(password_text) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters long';
  END IF;
  
  -- Return a marker indicating password should be hashed in edge function
  RETURN 'HASH_IN_EDGE_FUNCTION:' || password_text;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_password_strength(password_text text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Minimum 8 characters
  IF LENGTH(password_text) < 8 THEN
    RETURN FALSE;
  END IF;
  
  -- Must contain at least one letter and one number
  IF NOT (password_text ~ '[A-Za-z]' AND password_text ~ '[0-9]') THEN
    RETURN FALSE;
  END IF;
  
  -- Check for common weak passwords
  IF LOWER(password_text) IN ('password', '12345678', 'password123', 'admin123') THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Log completion of security hardening
INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    new_values
) VALUES (
    'security_hardening_search_paths_complete',
    'Payment Security',
    'Additional security hardening completed - function search paths secured',
    auth.uid(),
    jsonb_build_object(
        'remediation_date', NOW(),
        'functions_hardened', jsonb_build_array(
            'deactivate_admin_user',
            'activate_admin_user', 
            'update_admin_role',
            'get_delivery_reports',
            'assign_rider_to_order',
            'create_driver_with_profile',
            'validate_admin_access',
            'migrate_pay_to_txn_reference',
            'hash_password',
            'validate_password_strength'
        ),
        'security_improvement', 'search_path_hardening'
    )
);

COMMENT ON FUNCTION public.validate_admin_access() IS 'Secure admin access validation with comprehensive logging and security incident tracking';