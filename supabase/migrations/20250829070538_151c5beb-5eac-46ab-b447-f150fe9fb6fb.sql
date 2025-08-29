-- Fix critical security issue: Protect customer personal information
-- Drop any existing overly permissive policies on customers table
DROP POLICY IF EXISTS "Public can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.customers;
DROP POLICY IF EXISTS "Anyone can read customers" ON public.customers;

-- Ensure RLS is enabled on customers table
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create secure RLS policies for customers table
-- 1. Admins can manage all customer data
CREATE POLICY "Admins can manage all customers"
  ON public.customers
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- 2. Service roles can manage customer data (for system operations)
CREATE POLICY "Service roles can manage customers"
  ON public.customers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Customers can only view and update their own data
CREATE POLICY "Customers can view own data"
  ON public.customers
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND (
      user_id = auth.uid() 
      OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Customers can update own data"
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

-- 4. Allow authenticated users to create customer records (for registration)
CREATE POLICY "Authenticated users can create customer records"
  ON public.customers
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (
      user_id = auth.uid() 
      OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Add audit logging for customer data access
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