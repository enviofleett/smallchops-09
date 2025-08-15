-- Fix function parameter conflict by dropping and recreating
DROP FUNCTION IF EXISTS public.calculate_delivery_metrics(date);

-- Recreate with correct parameter name and search_path
CREATE OR REPLACE FUNCTION public.calculate_delivery_metrics(target_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert or update daily metrics
  INSERT INTO delivery_analytics (
    date,
    total_deliveries,
    completed_deliveries,
    failed_deliveries,
    total_delivery_fees,
    average_delivery_time_minutes
  )
  SELECT 
    target_date,
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'delivered'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COALESCE(SUM(delivery_fee), 0),
    COALESCE(AVG(EXTRACT(EPOCH FROM (delivered_at - created_at))/60), 0)
  FROM orders
  WHERE DATE(created_at) = target_date
    AND order_type = 'delivery'
  ON CONFLICT (date) DO UPDATE SET
    total_deliveries = EXCLUDED.total_deliveries,
    completed_deliveries = EXCLUDED.completed_deliveries,
    failed_deliveries = EXCLUDED.failed_deliveries,
    total_delivery_fees = EXCLUDED.total_delivery_fees,
    average_delivery_time_minutes = EXCLUDED.average_delivery_time_minutes,
    updated_at = NOW();
END;
$$;

-- Fix remaining functions with search_path
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.jwt() ->> 'email';
$$;

CREATE OR REPLACE FUNCTION public.get_current_logo()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT logo_url FROM logo_versions WHERE is_current = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.log_customer_operation(
  p_operation text,
  p_customer_id uuid,
  p_changes jsonb DEFAULT '{}',
  p_admin_id uuid DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    p_changes,
    p_ip_address::text,
    p_user_agent
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_admin_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin' 
    AND is_active = true
  );
$$;