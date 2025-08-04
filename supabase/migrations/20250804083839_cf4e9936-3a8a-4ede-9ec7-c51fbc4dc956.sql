-- Fix customer analytics permissions by adding missing RLS policies for customer_accounts table
-- This resolves the "permission denied for table users" error

-- Add missing RLS policy for customer_accounts table (needed for customer analytics)
DO $$
BEGIN
  -- Check if the policy already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_accounts' 
    AND policyname = 'Admins can view all customer accounts'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can view all customer accounts" ON public.customer_accounts FOR SELECT USING (is_admin())';
  END IF;
END $$;

-- Also ensure customer_purchase_analytics has proper admin access
DO $$
BEGIN
  -- Check if the policy already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_purchase_analytics' 
    AND policyname = 'Admins can view customer analytics'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can view customer analytics" ON public.customer_purchase_analytics FOR SELECT USING (is_admin())';
  END IF;
END $$;

-- Log the fix
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'fix_customer_analytics_permissions',
  'Security',
  'Fixed missing RLS policies for customer analytics access',
  jsonb_build_object(
    'tables_fixed', ARRAY['customer_accounts', 'customer_purchase_analytics'],
    'issue', 'permission denied for table users error in customer analytics',
    'resolution', 'Added proper admin SELECT policies'
  )
);