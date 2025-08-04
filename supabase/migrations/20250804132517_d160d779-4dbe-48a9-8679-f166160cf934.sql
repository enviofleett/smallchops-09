-- Fix customer display issues by updating RLS policies and improving data access

-- 1. Add missing customers table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on customers table
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 2. Create comprehensive admin access policies for customers
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
CREATE POLICY "Admins can manage customers" 
ON public.customers 
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Allow service role full access for edge functions
DROP POLICY IF EXISTS "Service role can access customers" ON public.customers;
CREATE POLICY "Service role can access customers" 
ON public.customers 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- 3. Ensure orders table has proper admin access
DROP POLICY IF EXISTS "Admins can view orders" ON public.orders;
CREATE POLICY "Admins can view orders" 
ON public.orders 
FOR SELECT 
TO authenticated
USING (is_admin());

-- Service role access for orders (for edge functions)
DROP POLICY IF EXISTS "Service role can access orders" ON public.orders;
CREATE POLICY "Service role can access orders" 
ON public.orders 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- 4. Create a safe customer analytics function that doesn't access auth.users
CREATE OR REPLACE FUNCTION public.get_customer_analytics_safe(
  p_start_date timestamp with time zone DEFAULT (now() - interval '30 days'),
  p_end_date timestamp with time zone DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_total_customers integer := 0;
  v_guest_customers integer := 0;
  v_authenticated_customers integer := 0;
  v_total_orders integer := 0;
  v_total_revenue numeric := 0;
  v_active_customers integer := 0;
  v_repeat_customers integer := 0;
  v_result jsonb;
BEGIN
  -- Get authenticated customers count
  SELECT COUNT(*) INTO v_authenticated_customers
  FROM public.customer_accounts;
  
  -- Get orders data and calculate metrics
  SELECT 
    COUNT(*) as total_orders,
    COALESCE(SUM(total_amount), 0) as total_revenue,
    COUNT(DISTINCT CASE WHEN customer_id IS NOT NULL THEN customer_id END) +
    COUNT(DISTINCT CASE WHEN customer_id IS NULL THEN customer_email END) as unique_customers
  INTO v_total_orders, v_total_revenue, v_total_customers
  FROM public.orders
  WHERE order_time BETWEEN p_start_date AND p_end_date
    AND status != 'cancelled';
  
  -- Get guest customers (orders without customer_id)
  SELECT COUNT(DISTINCT customer_email)
  INTO v_guest_customers
  FROM public.orders
  WHERE customer_id IS NULL 
    AND customer_email IS NOT NULL
    AND order_time BETWEEN p_start_date AND p_end_date;
  
  -- Calculate active customers (those with orders)
  v_active_customers := GREATEST(v_total_customers - v_guest_customers, 0);
  
  -- Get repeat customers count
  WITH customer_order_counts AS (
    SELECT 
      COALESCE(customer_id::text, customer_email) as customer_key,
      COUNT(*) as order_count
    FROM public.orders
    WHERE order_time BETWEEN p_start_date AND p_end_date
      AND status != 'cancelled'
    GROUP BY COALESCE(customer_id::text, customer_email)
  )
  SELECT COUNT(*) INTO v_repeat_customers
  FROM customer_order_counts
  WHERE order_count > 1;
  
  -- Include both registered and guest customers in total
  v_total_customers := v_authenticated_customers + v_guest_customers;
  
  -- Build result
  v_result := jsonb_build_object(
    'metrics', jsonb_build_object(
      'totalCustomers', v_total_customers,
      'activeCustomers', v_active_customers,
      'guestCustomers', v_guest_customers,
      'authenticatedCustomers', v_authenticated_customers,
      'avgOrderValue', CASE WHEN v_total_orders > 0 THEN v_total_revenue / v_total_orders ELSE 0 END,
      'repeatCustomerRate', CASE WHEN v_total_customers > 0 THEN (v_repeat_customers::numeric / v_total_customers) * 100 ELSE 0 END
    ),
    'totalOrders', v_total_orders,
    'totalRevenue', v_total_revenue
  );
  
  RETURN v_result;
END;
$$;

-- 5. Create function to get all customers for display (combining customer_accounts and guest orders)
CREATE OR REPLACE FUNCTION public.get_all_customers_display()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_customers jsonb := '[]'::jsonb;
  v_customer_record record;
  v_guest_record record;
BEGIN
  -- Get authenticated customers with order data
  FOR v_customer_record IN
    SELECT 
      ca.id,
      ca.name,
      COALESCE(u_orders.email, ca.name) as email, -- Fallback to name if no orders
      ca.phone,
      COALESCE(order_stats.total_orders, 0) as total_orders,
      COALESCE(order_stats.total_spent, 0) as total_spent,
      COALESCE(order_stats.last_order_date, ca.created_at) as last_order_date,
      false as is_guest,
      CASE 
        WHEN COALESCE(order_stats.total_spent, 0) > 5000 THEN 'VIP'
        WHEN COALESCE(order_stats.total_orders, 0) > 1 THEN 'Active'
        WHEN COALESCE(order_stats.total_orders, 0) = 1 THEN 'Active'
        ELSE 'Registered'
      END as status
    FROM public.customer_accounts ca
    LEFT JOIN (
      SELECT 
        customer_id,
        COUNT(*) as total_orders,
        SUM(total_amount) as total_spent,
        MAX(order_time) as last_order_date,
        customer_email as email
      FROM public.orders 
      WHERE customer_id IS NOT NULL AND status != 'cancelled'
      GROUP BY customer_id, customer_email
    ) order_stats ON ca.id = order_stats.customer_id
    LEFT JOIN (
      SELECT DISTINCT customer_id, customer_email as email
      FROM public.orders 
      WHERE customer_id IS NOT NULL
    ) u_orders ON ca.id = u_orders.customer_id
  LOOP
    v_customers := v_customers || jsonb_build_object(
      'id', v_customer_record.id,
      'name', v_customer_record.name,
      'email', v_customer_record.email,
      'phone', v_customer_record.phone,
      'totalOrders', v_customer_record.total_orders,
      'totalSpent', v_customer_record.total_spent,
      'lastOrderDate', v_customer_record.last_order_date,
      'status', v_customer_record.status,
      'isGuest', v_customer_record.is_guest
    );
  END LOOP;
  
  -- Get guest customers (from orders without customer_id)
  FOR v_guest_record IN
    SELECT 
      'guest-' || md5(customer_email || customer_name) as id,
      customer_name as name,
      customer_email as email,
      customer_phone as phone,
      COUNT(*) as total_orders,
      SUM(total_amount) as total_spent,
      MAX(order_time) as last_order_date,
      true as is_guest,
      CASE 
        WHEN SUM(total_amount) > 5000 THEN 'VIP'
        WHEN COUNT(*) > 1 THEN 'Active'
        ELSE 'Inactive'
      END as status
    FROM public.orders
    WHERE customer_id IS NULL 
      AND customer_email IS NOT NULL
      AND status != 'cancelled'
    GROUP BY customer_name, customer_email, customer_phone
  LOOP
    v_customers := v_customers || jsonb_build_object(
      'id', v_guest_record.id,
      'name', v_guest_record.name,
      'email', v_guest_record.email,
      'phone', v_guest_record.phone,
      'totalOrders', v_guest_record.total_orders,
      'totalSpent', v_guest_record.total_spent,
      'lastOrderDate', v_guest_record.last_order_date,
      'status', v_guest_record.status,
      'isGuest', v_guest_record.is_guest
    );
  END LOOP;
  
  RETURN v_customers;
END;
$$;

-- 6. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_customer_analytics_safe TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_all_customers_display TO authenticated, service_role;