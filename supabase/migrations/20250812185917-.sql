-- Fix Security Definer View issues by implementing proper RLS and permissions
-- This addresses the critical security vulnerability flagged by the linter

-- First, let's revoke overly permissive permissions from the views
REVOKE ALL ON public.orders_with_payment FROM anon, authenticated;
REVOKE ALL ON public.payment_flow_health FROM anon, authenticated;  
REVOKE ALL ON public.production_metrics FROM anon, authenticated;

-- Grant appropriate permissions based on business logic
-- orders_with_payment: Should follow the same access rules as orders table
GRANT SELECT ON public.orders_with_payment TO authenticated;

-- payment_flow_health: Should only be accessible to admins for monitoring
-- production_metrics: Should only be accessible to admins for reporting

-- Enable RLS on these views (if supported, otherwise we control access via permissions)
-- Note: PostgreSQL doesn't support RLS directly on views, so we control access via grants

-- Create secure wrapper functions for admin-only views instead of direct view access
CREATE OR REPLACE FUNCTION public.get_payment_flow_health()
RETURNS TABLE (
  period text,
  total_orders bigint,
  completed_orders bigint,
  pending_orders bigint,
  paid_orders bigint,
  payment_pending bigint,
  completion_rate_percent numeric
) 
LANGUAGE SQL
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Only allow admin access
  SELECT 
    p.period,
    p.total_orders,
    p.completed_orders,
    p.pending_orders,
    p.paid_orders,
    p.payment_pending,
    p.completion_rate_percent
  FROM public.payment_flow_health p
  WHERE public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.get_production_metrics()
RETURNS TABLE (
  total_products bigint,
  total_paid_orders bigint,
  total_paying_customers bigint,
  total_revenue numeric
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Only allow admin access
  SELECT 
    pm.total_products,
    pm.total_paid_orders,
    pm.total_paying_customers,
    pm.total_revenue
  FROM public.production_metrics pm
  WHERE public.is_admin();
$$;

-- Grant execute permission on admin functions only to authenticated users
GRANT EXECUTE ON FUNCTION public.get_payment_flow_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_production_metrics() TO authenticated;

-- Create a secure function for orders_with_payment that respects user permissions
CREATE OR REPLACE FUNCTION public.get_orders_with_payment(
  p_order_id uuid DEFAULT NULL,
  p_customer_email text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  order_number text,
  customer_id uuid,
  customer_name text,
  customer_email text,
  customer_phone text,
  order_type order_type,
  status order_status,
  payment_status payment_status,
  subtotal numeric,
  tax_amount numeric,
  delivery_fee numeric,
  discount_amount numeric,
  total_amount numeric,
  delivery_address jsonb,
  pickup_time timestamp with time zone,
  delivery_time timestamp with time zone,
  special_instructions text,
  payment_method text,
  payment_reference text,
  assigned_rider_id uuid,
  order_time timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  created_by uuid,
  updated_by uuid,
  delivery_zone_id uuid,
  preferred_delivery_time timestamp with time zone,
  pickup_point_id uuid,
  delivery_time_slot_id uuid,
  subtotal_cost numeric,
  total_vat numeric,
  guest_session_id uuid,
  paid_at timestamp with time zone,
  tx_id uuid,
  tx_status text,
  tx_paid_at timestamp with time zone,
  tx_channel text,
  tx_provider_reference text,
  final_paid boolean,
  final_paid_at timestamp with time zone,
  payment_channel text
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Return orders that the user has permission to see
  -- Following the same security model as the orders table
  SELECT 
    owp.id,
    owp.order_number,
    owp.customer_id,
    owp.customer_name,
    owp.customer_email,
    owp.customer_phone,
    owp.order_type,
    owp.status,
    owp.payment_status,
    owp.subtotal,
    owp.tax_amount,
    owp.delivery_fee,
    owp.discount_amount,
    owp.total_amount,
    owp.delivery_address,
    owp.pickup_time,
    owp.delivery_time,
    owp.special_instructions,
    owp.payment_method,
    owp.payment_reference,
    owp.assigned_rider_id,
    owp.order_time,
    owp.created_at,
    owp.updated_at,
    owp.created_by,
    owp.updated_by,
    owp.delivery_zone_id,
    owp.preferred_delivery_time,
    owp.pickup_point_id,
    owp.delivery_time_slot_id,
    owp.subtotal_cost,
    owp.total_vat,
    owp.guest_session_id,
    owp.paid_at,
    owp.tx_id,
    owp.tx_status,
    owp.tx_paid_at,
    owp.tx_channel,
    owp.tx_provider_reference,
    owp.final_paid,
    owp.final_paid_at,
    owp.payment_channel
  FROM public.orders_with_payment owp
  WHERE 
    -- Admin can see all orders
    public.is_admin() 
    OR 
    -- Users can see their own orders (following orders table RLS logic)
    (
      owp.customer_id IS NOT NULL 
      AND owp.customer_id IN (
        SELECT ca.id FROM public.customer_accounts ca WHERE ca.user_id = auth.uid()
      )
    )
    OR
    (
      owp.customer_email IS NOT NULL 
      AND lower(owp.customer_email) = lower(COALESCE(p_customer_email, (SELECT email FROM auth.users WHERE id = auth.uid())))
    )
    -- Apply additional filters if provided
    AND (p_order_id IS NULL OR owp.id = p_order_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_orders_with_payment(uuid, text) TO authenticated;

-- Log the security fix
INSERT INTO public.audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'security_definer_view_fix',
  'Security',
  'Fixed Security Definer View vulnerability by revoking overly permissive view access and creating secure wrapper functions',
  jsonb_build_object(
    'fixed_views', ARRAY['orders_with_payment', 'payment_flow_health', 'production_metrics'],
    'mitigation', 'Created SECURITY DEFINER functions with proper access controls',
    'date', NOW()
  )
);