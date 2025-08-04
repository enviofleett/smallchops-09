-- Fix missing RLS policies for customer analytics

-- Add missing RLS policy for admins to view customers
CREATE POLICY "Admins can view all customers" 
  ON public.customers 
  FOR SELECT 
  USING (is_admin());

-- Ensure customer_purchase_analytics has proper admin access
CREATE POLICY "Admins can view customer analytics" 
  ON public.customer_purchase_analytics 
  FOR SELECT 
  USING (is_admin());

-- Add missing admin policies for other customer-related tables if they don't exist
DO $$
BEGIN
  -- Check and add policy for customer_accounts if needed
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_accounts' 
    AND policyname = 'Admins can view all customer accounts'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can view all customer accounts" ON public.customer_accounts FOR SELECT USING (is_admin())';
  END IF;

  -- Check and add policy for customer_addresses if needed  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_addresses' 
    AND policyname = 'Admins can view all customer addresses'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can view all customer addresses" ON public.customer_addresses FOR SELECT USING (is_admin())';
  END IF;
END $$;