-- Fix remaining security linter warnings

-- 1. Fix all functions missing search_path (addressing WARN 3-14)
CREATE OR REPLACE FUNCTION public.update_delivery_metrics_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Update metrics for the delivery date
  IF NEW.order_type = 'delivery' THEN
    PERFORM calculate_delivery_metrics(CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_delivery_metrics(target_date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  metrics_record RECORD;
BEGIN
  -- Calculate metrics for the target date
  SELECT 
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'delivered' OR status = 'completed') as completed_deliveries,
    SUM(total_amount) as revenue,
    AVG(
      EXTRACT(EPOCH FROM (updated_at - created_at)) / 60
    )::INTEGER as avg_time_minutes
  INTO metrics_record
  FROM orders o
  LEFT JOIN order_delivery_schedule ods ON o.id = ods.order_id
  WHERE o.order_type = 'delivery'
    AND DATE(COALESCE(ods.delivery_date::date, o.created_at::date)) = target_date;

  -- Insert or update metrics
  INSERT INTO delivery_performance_metrics (
    metric_date, 
    total_deliveries, 
    successful_deliveries,
    average_delivery_time,
    created_at
  ) VALUES (
    target_date,
    COALESCE(metrics_record.total_deliveries, 0),
    COALESCE(metrics_record.completed_deliveries, 0),
    COALESCE(metrics_record.avg_time_minutes, 0),
    NOW()
  )
  ON CONFLICT (metric_date) 
  DO UPDATE SET
    total_deliveries = EXCLUDED.total_deliveries,
    successful_deliveries = EXCLUDED.successful_deliveries,
    average_delivery_time = EXCLUDED.average_delivery_time,
    created_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  allowed jsonb := '{
    "pending": ["confirmed","cancelled","refunded","failed"],
    "confirmed": ["preparing","cancelled","refunded"],
    "preparing": ["ready","cancelled"],
    "ready": ["out_for_delivery","delivered","cancelled"],
    "out_for_delivery": ["delivered","completed","cancelled"],
    "delivered": ["completed","refunded"],
    "completed": ["refunded"],
    "failed": ["pending","cancelled"]
  }';
  old_status text;
  new_status text;
BEGIN
  old_status := COALESCE(OLD.status::text, '');
  new_status := COALESCE(NEW.status::text, old_status);

  IF old_status IS DISTINCT FROM new_status THEN
    IF NOT (allowed ? old_status) OR NOT ((allowed->old_status) ? new_status) THEN
      RAISE EXCEPTION 'Invalid order status transition: % -> %', old_status, new_status;
    END IF;
  END IF;

  -- Only require rider assignment for active delivery statuses
  IF new_status IN ('out_for_delivery','delivered','completed') AND new_status != 'cancelled' THEN
    IF NEW.assigned_rider_id IS NULL THEN
      RAISE EXCEPTION 'A dispatch rider must be assigned before moving to %', new_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_daily_delivery_analytics(target_date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  analytics_record RECORD;
BEGIN
  -- Calculate overall delivery analytics
  SELECT 
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status IN ('delivered', 'completed')) as completed_deliveries,
    COUNT(*) FILTER (WHERE status = 'cancelled') as failed_deliveries,
    COALESCE(SUM(delivery_fee), 0) as total_delivery_fees,
    COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60), 0)::INTEGER as avg_time_minutes,
    0 as total_distance_km -- Will be calculated from route data when available
  INTO analytics_record
  FROM orders o
  LEFT JOIN order_delivery_schedule ods ON o.id = ods.order_id
  WHERE o.order_type = 'delivery'
    AND DATE(COALESCE(ods.delivery_date::date, o.created_at::date)) = target_date;

  -- Insert or update daily analytics (implement the actual table structure based on your schema)
  -- This is a placeholder - adjust based on your actual delivery analytics table structure
END;
$$;

CREATE OR REPLACE FUNCTION public.update_dispatch_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Update analytics when assignment status changes
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        -- Implement analytics logic here based on your schema
        NULL;
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.setup_hardcoded_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if this is the hardcoded admin email
  IF NEW.email = 'store@startersmallchops.com' THEN
    -- Ensure the profile has admin role
    NEW.role := 'admin'::user_role;
    NEW.is_active := true;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.setup_permissions_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;

-- Fix all remaining functions to have proper search paths
CREATE OR REPLACE FUNCTION public.trigger_payment_confirmation_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.payment_status IS DISTINCT FROM NEW.payment_status
     AND NEW.payment_status = 'paid' THEN
    INSERT INTO public.communication_events (
      order_id,
      event_type,
      recipient_email,
      template_key,
      email_type,
      status,
      variables,
      created_at
    ) VALUES (
      NEW.id,
      'payment_confirmation',
      NEW.customer_email,
      'payment_confirmation',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', NEW.customer_name,
        'orderNumber', NEW.order_number,
        'amount', NEW.total_amount::text,
        'paymentMethod', COALESCE(NEW.payment_method, 'Online Payment')
      ),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_paid_at_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' 
     AND (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
     AND NEW.payment_status = 'paid' THEN
    NEW.paid_at := COALESCE(NEW.paid_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_payment_transaction_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_payment_polling_state_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;