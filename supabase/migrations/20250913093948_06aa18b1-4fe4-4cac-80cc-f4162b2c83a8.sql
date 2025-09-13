-- EMERGENCY SECURITY FIX: Lock down customers table immediately

-- First, drop ALL existing policies that may be flawed
DROP POLICY IF EXISTS "Secure: Admins manage all customers" ON public.customers;
DROP POLICY IF EXISTS "Secure: Authenticated users create customer records" ON public.customers;
DROP POLICY IF EXISTS "Secure: Customers update own data" ON public.customers;
DROP POLICY IF EXISTS "Secure: Customers view own data" ON public.customers;
DROP POLICY IF EXISTS "Secure: Service roles manage customers" ON public.customers;

-- Create strict admin-only policy for all operations
CREATE POLICY "customers_admin_full_access" 
ON public.customers 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = 'admin'::user_role 
      AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = 'admin'::user_role 
      AND is_active = true
  )
);

-- Create policy for customers to view/update only their own data
CREATE POLICY "customers_own_data_access" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (
  user_id = auth.uid()
);

-- Allow customers to update their own data
CREATE POLICY "customers_own_data_update" 
ON public.customers 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow service roles for system operations (edge functions)
CREATE POLICY "customers_service_role_access" 
ON public.customers 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Create secure function for customer registration (called by edge functions)
CREATE OR REPLACE FUNCTION public.create_customer_record(
  p_email text,
  p_name text,
  p_phone text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_customer_id uuid;
  v_requesting_user_id uuid;
BEGIN
  -- Get the requesting user ID
  v_requesting_user_id := auth.uid();
  
  -- Only allow if user is creating their own record or is admin
  IF p_user_id IS NOT NULL AND p_user_id != v_requesting_user_id THEN
    -- Check if user is admin
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = v_requesting_user_id 
        AND role = 'admin'::user_role 
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Access denied - cannot create customer record for another user';
    END IF;
  END IF;
  
  -- Insert customer record
  INSERT INTO public.customers (
    email,
    name,
    phone,
    user_id
  ) VALUES (
    LOWER(TRIM(p_email)),
    TRIM(p_name),
    CASE WHEN TRIM(p_phone) = '' THEN NULL ELSE TRIM(p_phone) END,
    COALESCE(p_user_id, v_requesting_user_id)
  ) RETURNING id INTO v_customer_id;
  
  -- Log the customer creation
  INSERT INTO public.audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values
  ) VALUES (
    'customer_created',
    'Customer Management',
    'New customer record created',
    v_requesting_user_id,
    v_customer_id,
    jsonb_build_object(
      'email', p_email,
      'name', p_name,
      'phone', p_phone,
      'user_id', COALESCE(p_user_id, v_requesting_user_id)
    )
  );
  
  RETURN v_customer_id;
END;
$$;

-- Log this critical security fix
INSERT INTO public.audit_logs (
  action,
  category,
  message,
  user_id,
  new_values
) VALUES (
  'critical_security_fix_applied',
  'Security',
  'EMERGENCY: Fixed customers table public access vulnerability',
  auth.uid(),
  jsonb_build_object(
    'fix_type', 'customers_table_security',
    'severity', 'critical',
    'issue', 'customers_table_publicly_accessible',
    'applied_at', NOW()
  )
);