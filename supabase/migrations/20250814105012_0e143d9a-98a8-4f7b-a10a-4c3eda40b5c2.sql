-- Fix RLS policy for performance_analytics table
-- This addresses the 403 errors we've been seeing

-- Drop existing policies first
DROP POLICY IF EXISTS "Admins can view performance analytics" ON public.performance_analytics;
DROP POLICY IF EXISTS "Service roles can insert performance analytics" ON public.performance_analytics;

-- Recreate with correct permissions
CREATE POLICY "Admins can view performance analytics"
ON public.performance_analytics
FOR SELECT
USING (is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Service roles can insert performance analytics"
ON public.performance_analytics
FOR INSERT
WITH CHECK (auth.role() = 'service_role' OR is_admin());

-- Verify the orders_with_payment view has correct security definer setting
-- Since this was flagged as an ERROR in the linter, let's examine and fix
DROP VIEW IF EXISTS public.orders_with_payment CASCADE;

-- Recreate the view without SECURITY DEFINER to address linter error
CREATE VIEW public.orders_with_payment AS
SELECT 
  o.id,
  o.order_number,
  o.customer_id,
  o.customer_name,
  o.customer_email,
  o.customer_phone,
  o.order_type,
  o.status,
  o.payment_status,
  o.subtotal,
  o.tax_amount,
  o.delivery_fee,
  o.discount_amount,
  o.total_amount,
  o.delivery_address,
  o.pickup_time,
  o.delivery_time,
  o.special_instructions,
  o.payment_method,
  o.payment_reference,
  o.assigned_rider_id,
  o.order_time,
  o.created_at,
  o.updated_at,
  o.created_by,
  o.updated_by,
  o.delivery_zone_id,
  o.preferred_delivery_time,
  o.pickup_point_id,
  o.delivery_time_slot_id,
  o.subtotal_cost,
  o.total_vat,
  o.guest_session_id,
  o.paid_at,
  pt.id as tx_id,
  pt.status as tx_status,
  pt.paid_at as tx_paid_at,
  pt.channel as tx_channel,
  pt.provider_reference as tx_provider_reference,
  (CASE WHEN o.payment_status = 'paid' OR pt.status IN ('success', 'paid') THEN true ELSE false END) as final_paid,
  COALESCE(o.paid_at, pt.paid_at) as final_paid_at,
  COALESCE(o.payment_method, pt.channel, 'unknown') as payment_channel
FROM public.orders o
LEFT JOIN public.payment_transactions pt ON (
  pt.order_id = o.id 
  OR pt.provider_reference = o.payment_reference
  OR pt.provider_reference = o.paystack_reference
);

-- Create RLS policy for the view
ALTER VIEW public.orders_with_payment SET (security_barrier = true);

-- Grant appropriate permissions
GRANT SELECT ON public.orders_with_payment TO authenticated;
GRANT SELECT ON public.orders_with_payment TO service_role;