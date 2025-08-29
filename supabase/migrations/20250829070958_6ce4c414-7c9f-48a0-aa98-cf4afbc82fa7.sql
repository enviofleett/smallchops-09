-- Fix critical security issue: Protect customer personal information
-- First check and drop ALL existing policies on customers table
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'customers'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- Ensure RLS is enabled on customers table
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create secure RLS policies for customers table
-- 1. Admins can manage all customer data
CREATE POLICY "Secure: Admins manage all customers"
  ON public.customers
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- 2. Service roles can manage customer data (for system operations)
CREATE POLICY "Secure: Service roles manage customers"
  ON public.customers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Customers can only view their own data
CREATE POLICY "Secure: Customers view own data"
  ON public.customers
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND (
      user_id = auth.uid() 
      OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- 4. Customers can update their own data
CREATE POLICY "Secure: Customers update own data"
  ON public.customers
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL 
    AND (
      user_id = auth.uid() 
      OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (
      user_id = auth.uid() 
      OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- 5. Allow authenticated users to create customer records (for registration)
CREATE POLICY "Secure: Authenticated users create customer records"
  ON public.customers
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (
      user_id = auth.uid() 
      OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Add audit logging for customer data access (replace if exists)
CREATE OR REPLACE FUNCTION public.log_customer_data_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log access to sensitive customer data
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values
  ) VALUES (
    CASE 
      WHEN TG_OP = 'SELECT' THEN 'customer_data_viewed'
      WHEN TG_OP = 'INSERT' THEN 'customer_data_created'
      WHEN TG_OP = 'UPDATE' THEN 'customer_data_updated'
      WHEN TG_OP = 'DELETE' THEN 'customer_data_deleted'
      ELSE TG_OP
    END,
    'Customer Data Security',
    'Customer data accessed: ' || COALESCE(NEW.email, OLD.email, 'unknown'),
    auth.uid(),
    COALESCE(NEW.id, OLD.id),
    CASE 
      WHEN NEW IS NOT NULL THEN to_jsonb(NEW)
      ELSE NULL
    END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Apply audit trigger to customers table
DROP TRIGGER IF EXISTS customer_data_audit_trigger ON public.customers;
CREATE TRIGGER customer_data_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.log_customer_data_access();