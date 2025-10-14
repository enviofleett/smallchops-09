-- ============================================================================
-- COMPLETE SECURITY FIX - ALL PHASES
-- Phase 4: Row-Level Security (RLS) Policies for Orders Table
-- ============================================================================

-- Step 1: Drop existing problematic policies
DROP POLICY IF EXISTS "admin_full_access_orders" ON public.orders;
DROP POLICY IF EXISTS "service_role_full_access_orders" ON public.orders;
DROP POLICY IF EXISTS "customers_view_own_orders" ON public.orders;
DROP POLICY IF EXISTS "prevent_customer_updates" ON public.orders;
DROP POLICY IF EXISTS "log_unauthorized_order_updates" ON public.orders;

-- Step 2: Create security definer function for customer order access
CREATE OR REPLACE FUNCTION public.customer_can_view_order(order_row public.orders)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Customer can view if:
  -- 1. They are authenticated AND
  -- 2. The order belongs to them (via customer_id OR customer_email)
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND (
        order_row.customer_id = auth.uid()
        OR order_row.customer_email = email
      )
  );
$$;

-- Step 3: Create RLS Policies with proper structure
-- Policy 1: Admins have full access to all orders
CREATE POLICY "admins_full_access_orders"
ON public.orders
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Policy 2: Service role has full access (for edge functions)
CREATE POLICY "service_role_full_access_orders"
ON public.orders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy 3: Customers can view their own orders (SELECT only)
CREATE POLICY "customers_view_own_orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  customer_can_view_order(orders.*)
);

-- Policy 4: Prevent direct customer updates (they must use edge functions)
CREATE POLICY "prevent_direct_customer_updates"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  -- Only allow updates if user is admin
  -- This prevents customers from updating orders directly
  is_admin()
)
WITH CHECK (
  is_admin()
);

-- Policy 5: Prevent direct customer inserts (use checkout edge function)
CREATE POLICY "prevent_direct_customer_inserts"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  -- Only admins or service role can insert
  is_admin()
);

-- Policy 6: Prevent direct customer deletes
CREATE POLICY "prevent_direct_customer_deletes"
ON public.orders
FOR DELETE
TO authenticated
USING (
  is_admin()
);

-- Step 4: Create audit logging trigger for unauthorized access attempts
CREATE OR REPLACE FUNCTION public.log_order_access_violation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email text;
  v_is_admin boolean;
BEGIN
  -- Get user info
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Check if user is admin
  v_is_admin := is_admin();
  
  -- Log if non-admin attempts to update
  IF NOT v_is_admin AND TG_OP IN ('UPDATE', 'DELETE') THEN
    INSERT INTO audit_logs (
      action,
      category,
      message,
      user_id,
      entity_id,
      old_values,
      new_values
    ) VALUES (
      'unauthorized_order_access_attempt',
      'Security Violation',
      'Non-admin user attempted to ' || TG_OP || ' order #' || COALESCE(OLD.order_number, NEW.order_number),
      auth.uid(),
      COALESCE(OLD.id, NEW.id),
      CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
      CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for access violation logging
DROP TRIGGER IF EXISTS log_order_access_violations ON public.orders;
CREATE TRIGGER log_order_access_violations
  BEFORE UPDATE OR DELETE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_access_violation();

-- Step 5: Ensure RLS is enabled
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Step 6: Grant necessary permissions
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

-- Step 7: Add helpful comments
COMMENT ON POLICY "admins_full_access_orders" ON public.orders IS 
  'Admins can perform all operations on orders using is_admin() function';

COMMENT ON POLICY "service_role_full_access_orders" ON public.orders IS 
  'Service role (edge functions) can perform all operations';

COMMENT ON POLICY "customers_view_own_orders" ON public.orders IS 
  'Customers can only view their own orders via SELECT';

COMMENT ON POLICY "prevent_direct_customer_updates" ON public.orders IS 
  'Prevents customers from directly updating orders - they must use admin edge functions';

COMMENT ON FUNCTION public.customer_can_view_order(public.orders) IS 
  'Security definer function to check if customer can view a specific order';

COMMENT ON FUNCTION public.log_order_access_violation() IS 
  'Logs unauthorized access attempts to orders table for security monitoring';