-- Complete database security fixes
-- Fix remaining search_path issues for functions

-- Fix log_customer_operation function
CREATE OR REPLACE FUNCTION public.log_customer_operation(p_operation text, p_customer_id uuid, p_details jsonb DEFAULT '{}'::jsonb, p_admin_id uuid DEFAULT NULL::uuid, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values,
    ip_address,
    user_agent
  ) VALUES (
    'customer_' || p_operation,
    'Customer Management',
    'Customer operation: ' || p_operation,
    COALESCE(p_admin_id, auth.uid()),
    p_customer_id,
    p_details,
    p_ip_address::text,
    p_user_agent
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$function$;

-- Fix trigger_email_processing function
CREATE OR REPLACE FUNCTION public.trigger_email_processing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO audit_logs (
    action, 
    category, 
    message, 
    new_values
  ) VALUES (
    'email_queued', 
    'Communication', 
    'Email event queued for processing: ' || NEW.event_type,
    jsonb_build_object(
      'event_id', NEW.id,
      'event_type', NEW.event_type,
      'recipient_email', NEW.recipient_email,
      'status', NEW.status
    )
  );
  
  RETURN NEW;
END;
$function$;

-- Fix create_logo_version function
CREATE OR REPLACE FUNCTION public.create_logo_version(p_logo_url text, p_file_size bigint, p_file_type text, p_dimensions jsonb, p_uploaded_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_version_number INTEGER;
  v_version_id UUID;
BEGIN
  -- Mark previous version as not current
  UPDATE logo_versions 
  SET is_current = FALSE, 
      replaced_at = NOW(),
      replaced_by = p_uploaded_by
  WHERE is_current = TRUE;
  
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 
  INTO v_version_number 
  FROM logo_versions;
  
  -- Insert new version
  INSERT INTO logo_versions (
    logo_url, version_number, file_size, file_type, 
    dimensions, uploaded_by, is_current
  ) VALUES (
    p_logo_url, v_version_number, p_file_size, p_file_type,
    p_dimensions, p_uploaded_by, TRUE
  ) RETURNING id INTO v_version_id;
  
  RETURN v_version_id;
END;
$function$;

-- Fix setup_hardcoded_admin function
CREATE OR REPLACE FUNCTION public.setup_hardcoded_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if this is the hardcoded admin email
  IF NEW.email = 'store@startersmallchops.com' THEN
    -- Ensure the profile has admin role
    NEW.role := 'admin'::user_role;
    NEW.is_active := true;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix setup_permissions_after_insert function
CREATE OR REPLACE FUNCTION public.setup_permissions_after_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if this is the hardcoded admin email
  IF NEW.email = 'store@startersmallchops.com' AND NEW.role = 'admin' THEN
    -- Set up all admin permissions except settings
    INSERT INTO user_permissions (user_id, menu_key, permission_level, menu_section, sub_menu_section)
    VALUES
      -- Dashboard permissions
      (NEW.id, 'dashboard', 'edit', 'main', null),
      
      -- Products permissions
      (NEW.id, 'products', 'edit', 'main', null),
      (NEW.id, 'product_list', 'edit', 'products', null),
      (NEW.id, 'product_categories', 'edit', 'products', null),
      (NEW.id, 'inventory', 'edit', 'products', null),
      
      -- Orders permissions
      (NEW.id, 'orders', 'edit', 'main', null),
      (NEW.id, 'order_list', 'edit', 'orders', null),
      (NEW.id, 'order_tracking', 'edit', 'orders', null),
      (NEW.id, 'order_management', 'edit', 'orders', null),
      
      -- Customer permissions
      (NEW.id, 'customers', 'edit', 'main', null),
      (NEW.id, 'customer_list', 'edit', 'customers', null),
      (NEW.id, 'customer_analytics', 'edit', 'customers', null),
      
      -- Reports permissions
      (NEW.id, 'reports', 'edit', 'main', null),
      (NEW.id, 'sales_reports', 'edit', 'reports', null),
      (NEW.id, 'revenue_reports', 'edit', 'reports', null),
      (NEW.id, 'analytics', 'edit', 'reports', null),
      
      -- Marketing permissions
      (NEW.id, 'marketing', 'edit', 'main', null),
      (NEW.id, 'campaigns', 'edit', 'marketing', null),
      (NEW.id, 'promotions', 'edit', 'marketing', null),
      (NEW.id, 'email_marketing', 'edit', 'marketing', null),
      
      -- Content permissions
      (NEW.id, 'content', 'edit', 'main', null),
      (NEW.id, 'blog', 'edit', 'content', null),
      (NEW.id, 'pages', 'edit', 'content', null),
      (NEW.id, 'media', 'edit', 'content', null),
      
      -- Operations permissions
      (NEW.id, 'operations', 'edit', 'main', null),
      (NEW.id, 'delivery', 'edit', 'operations', null),
      (NEW.id, 'inventory_management', 'edit', 'operations', null),
      (NEW.id, 'staff_management', 'edit', 'operations', null)
    ON CONFLICT (user_id, menu_key) DO NOTHING;

    -- Log the hardcoded admin creation
    INSERT INTO audit_logs (
      action,
      category,
      message,
      user_id,
      new_values
    ) VALUES (
      'hardcoded_admin_setup',
      'User Management',
      'Hardcoded admin user setup for store@startersmallchops.com with all permissions except settings',
      NEW.id,
      jsonb_build_object(
        'email', 'store@startersmallchops.com',
        'role', 'admin',
        'permissions_granted', 'all_except_settings',
        'total_permissions', 28,
        'hardcoded', true
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;