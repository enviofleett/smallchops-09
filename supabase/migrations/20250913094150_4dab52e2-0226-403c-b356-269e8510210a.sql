-- CRITICAL: Fix the public access issue by ensuring strict authentication-only policies

-- Drop ALL policies and recreate with explicit authentication requirements
DROP POLICY IF EXISTS "customers_admin_full_access" ON public.customers;
DROP POLICY IF EXISTS "customers_own_data_access" ON public.customers;
DROP POLICY IF EXISTS "customers_own_data_update" ON public.customers;
DROP POLICY IF EXISTS "customers_service_role_access" ON public.customers;

-- Create strict authentication-required policies ONLY

-- 1. Admin full access (requires authentication AND admin role)
CREATE POLICY "customers_admin_only" 
ON public.customers 
FOR ALL 
USING (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = 'admin'::user_role 
      AND is_active = true
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = 'admin'::user_role 
      AND is_active = true
  )
);

-- 2. Customer own data access (requires authentication AND user_id match)
CREATE POLICY "customers_own_select" 
ON public.customers 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
);

-- 3. Customer own data update (requires authentication AND user_id match)
CREATE POLICY "customers_own_update" 
ON public.customers 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
);

-- 4. NO INSERT policy for regular users - only through secure function

-- Log this additional security hardening
INSERT INTO public.audit_logs (
  action,
  category,
  message,
  user_id,
  new_values
) VALUES (
  'security_hardening_applied',
  'Security',
  'Additional hardening: Removed all public access to customers table',
  auth.uid(),
  jsonb_build_object(
    'fix_type', 'customers_table_strict_auth',
    'severity', 'critical',
    'applied_at', NOW()
  )
);