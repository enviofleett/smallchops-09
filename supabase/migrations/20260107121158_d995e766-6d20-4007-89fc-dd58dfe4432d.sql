-- ============================================
-- PRODUCTION SECURITY HARDENING MIGRATION
-- Fixes customer_accounts, business_sensitive_data, and orders RLS
-- ============================================

-- =========================================
-- 1. CLEAN UP customer_accounts POLICIES
-- Remove redundant and overlapping policies
-- =========================================

-- Drop all existing customer_accounts policies to start fresh
DROP POLICY IF EXISTS "Admin and service role access to customer accounts" ON public.customer_accounts;
DROP POLICY IF EXISTS "Admins can manage all customer accounts" ON public.customer_accounts;
DROP POLICY IF EXISTS "Service roles can manage customer accounts" ON public.customer_accounts;
DROP POLICY IF EXISTS "Users can update their own account" ON public.customer_accounts;
DROP POLICY IF EXISTS "Users can view their own account" ON public.customer_accounts;
DROP POLICY IF EXISTS "customer can update own account" ON public.customer_accounts;
DROP POLICY IF EXISTS "customer_accounts_production_access" ON public.customer_accounts;
DROP POLICY IF EXISTS "customer_accounts_production_insert" ON public.customer_accounts;
DROP POLICY IF EXISTS "customer_accounts_production_update" ON public.customer_accounts;
DROP POLICY IF EXISTS "customers_can_view_own_account" ON public.customer_accounts;
DROP POLICY IF EXISTS "customers_manage_own_account_safe" ON public.customer_accounts;

-- Create clean, non-overlapping policies for customer_accounts
-- Policy 1: Users can view ONLY their own account (requires authentication)
CREATE POLICY "customer_view_own_only"
ON public.customer_accounts
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Policy 2: Users can insert their own account (requires authentication)
CREATE POLICY "customer_insert_own_only"
ON public.customer_accounts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Policy 3: Users can update ONLY their own account (requires authentication)
CREATE POLICY "customer_update_own_only"
ON public.customer_accounts
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Policy 4: Admins can view all accounts (verified through is_admin function)
CREATE POLICY "admin_view_all_customers"
ON public.customer_accounts
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND is_admin());

-- Policy 5: Admins can manage all accounts
CREATE POLICY "admin_manage_all_customers"
ON public.customer_accounts
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND is_admin())
WITH CHECK (auth.uid() IS NOT NULL AND is_admin());

-- =========================================
-- 2. CLEAN UP business_sensitive_data POLICIES
-- Ensure only authenticated admins can access
-- =========================================

DROP POLICY IF EXISTS "admin_only_business_sensitive_data" ON public.business_sensitive_data;
DROP POLICY IF EXISTS "admin_only_manage_business_sensitive_data" ON public.business_sensitive_data;
DROP POLICY IF EXISTS "admin_only_read_business_sensitive_data" ON public.business_sensitive_data;

-- Only authenticated admins can access business sensitive data
CREATE POLICY "authenticated_admin_only_sensitive_data"
ON public.business_sensitive_data
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND is_admin())
WITH CHECK (auth.uid() IS NOT NULL AND is_admin());

-- =========================================
-- 3. CLEAN UP orders TABLE POLICIES
-- Simplify and secure order access
-- =========================================

DROP POLICY IF EXISTS "Authenticated users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Service roles can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "admins_full_access_orders" ON public.orders;
DROP POLICY IF EXISTS "customers_can_create_own_orders" ON public.orders;
DROP POLICY IF EXISTS "customers_view_own_orders" ON public.orders;
DROP POLICY IF EXISTS "prevent_direct_customer_deletes" ON public.orders;
DROP POLICY IF EXISTS "prevent_direct_customer_inserts" ON public.orders;
DROP POLICY IF EXISTS "prevent_direct_customer_updates" ON public.orders;
DROP POLICY IF EXISTS "service_role_full_access_orders" ON public.orders;

-- Policy 1: Customers can view ONLY their own orders
CREATE POLICY "orders_customer_view_own"
ON public.orders
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    customer_id = auth.uid() 
    OR customer_email = auth.email()
  )
);

-- Policy 2: Customers can create orders for themselves
CREATE POLICY "orders_customer_create"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND (
    customer_id = auth.uid() 
    OR customer_email = auth.email()
  )
);

-- Policy 3: Admins have full access to all orders
CREATE POLICY "orders_admin_full_access"
ON public.orders
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND is_admin())
WITH CHECK (auth.uid() IS NOT NULL AND is_admin());

-- Policy 4: Service role for backend operations (edge functions)
-- This is necessary for payment webhooks and automated processes
CREATE POLICY "orders_service_role_access"
ON public.orders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =========================================
-- 4. ADD SECURITY AUDIT LOGGING TRIGGER
-- Log all access to sensitive tables
-- =========================================

-- Create function to log sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    action,
    entity_type,
    entity_id,
    user_id,
    category,
    message,
    event_time
  ) VALUES (
    TG_OP,
    TG_TABLE_NAME,
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.id::text
      ELSE NEW.id::text
    END,
    auth.uid(),
    'security',
    'Sensitive data access: ' || TG_TABLE_NAME || ' - ' || TG_OP,
    now()
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Add audit trigger to business_sensitive_data
DROP TRIGGER IF EXISTS audit_business_sensitive_data ON public.business_sensitive_data;
CREATE TRIGGER audit_business_sensitive_data
  AFTER INSERT OR UPDATE OR DELETE ON public.business_sensitive_data
  FOR EACH ROW
  EXECUTE FUNCTION public.log_sensitive_access();

-- =========================================
-- 5. ENSURE RLS IS ENABLED
-- =========================================

ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_sensitive_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON POLICY "customer_view_own_only" ON public.customer_accounts IS 'Production security: Customers can only view their own account data';
COMMENT ON POLICY "authenticated_admin_only_sensitive_data" ON public.business_sensitive_data IS 'Production security: Only authenticated admins can access sensitive business data';
COMMENT ON POLICY "orders_customer_view_own" ON public.orders IS 'Production security: Customers can only view their own orders';