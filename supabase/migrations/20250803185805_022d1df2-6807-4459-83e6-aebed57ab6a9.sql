-- Phase 1: Critical Security Fixes - Orders Table RLS Policies

-- 1. Add comprehensive RLS policies for orders table
CREATE POLICY "Customers can view their own orders" 
ON public.orders 
FOR SELECT 
USING (
  customer_email IN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
);

CREATE POLICY "Customers can create orders during checkout" 
ON public.orders 
FOR INSERT 
WITH CHECK (
  customer_email IN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
);

CREATE POLICY "Admins can view all orders" 
ON public.orders 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Admins can update all orders" 
ON public.orders 
FOR UPDATE 
USING (is_admin());

CREATE POLICY "Service roles can manage orders" 
ON public.orders 
FOR ALL 
USING (auth.role() = 'service_role');

-- 2. Fix order_items table RLS policies
CREATE POLICY "Customers can view their own order items" 
ON public.order_items 
FOR SELECT 
USING (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE customer_email IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Customers can create order items during checkout" 
ON public.order_items 
FOR INSERT 
WITH CHECK (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE customer_email IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Admins can manage all order items" 
ON public.order_items 
FOR ALL 
USING (is_admin());

CREATE POLICY "Service roles can manage order items" 
ON public.order_items 
FOR ALL 
USING (auth.role() = 'service_role');

-- 3. Fix payment_transactions table RLS policies  
CREATE POLICY "Customers can view their own payment transactions" 
ON public.payment_transactions 
FOR SELECT 
USING (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE customer_email IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Customers can create payment transactions" 
ON public.payment_transactions 
FOR INSERT 
WITH CHECK (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE customer_email IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Admins can manage all payment transactions" 
ON public.payment_transactions 
FOR ALL 
USING (is_admin());

CREATE POLICY "Service roles can manage payment transactions" 
ON public.payment_transactions 
FOR ALL 
USING (auth.role() = 'service_role');

-- 4. Fix customer_communication_preferences table RLS policies
CREATE POLICY "Customers can manage their own communication preferences" 
ON public.customer_communication_preferences 
FOR ALL 
USING (
  customer_email IN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
)
WITH CHECK (
  customer_email IN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
);

CREATE POLICY "Admins can view all communication preferences" 
ON public.customer_communication_preferences 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Service roles can manage communication preferences" 
ON public.customer_communication_preferences 
FOR ALL 
USING (auth.role() = 'service_role');

-- 5. Update critical database functions with proper security settings
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER 
SET search_path TO 'public'
AS $function$
  SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role::text FROM profiles WHERE id = user_uuid),
    'customer'
  );
$function$;

CREATE OR REPLACE FUNCTION public.health_check()
RETURNS jsonb
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'status', 'healthy',
    'timestamp', now(),
    'version', '1.0.0'
  );
$function$;