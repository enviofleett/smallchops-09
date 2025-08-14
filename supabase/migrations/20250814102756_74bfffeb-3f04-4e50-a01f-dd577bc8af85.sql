-- PHASE 1: FIX CRITICAL DATABASE SCHEMA ISSUES

-- 1. Fix p.images references in database functions - replace with image_url
-- Find and update any functions that reference p.images

-- 2. Fix RLS policy for performance_analytics table
DROP POLICY IF EXISTS "Service roles can insert performance analytics" ON performance_analytics;
CREATE POLICY "Service roles can insert performance analytics" 
ON performance_analytics FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- 3. Fix function search paths for security (addressing linter warnings)
-- Update existing functions to have proper search_path
ALTER FUNCTION public.pg_notify(text, text) SET search_path = 'public';
ALTER FUNCTION public.get_payment_health_summary() SET search_path = 'public'; 
ALTER FUNCTION public.trigger_payment_confirmation_email() SET search_path = 'public';
ALTER FUNCTION public.create_order_with_items(uuid, text, jsonb, uuid, uuid, uuid, jsonb) SET search_path = 'public';
ALTER FUNCTION public.update_customer_with_validation(uuid, text, text, text, uuid, inet, text) SET search_path = 'public';
ALTER FUNCTION public.validate_order_update() SET search_path = 'public';
ALTER FUNCTION public.deactivate_admin_user(uuid) SET search_path = 'public';
ALTER FUNCTION public.activate_admin_user(uuid) SET search_path = 'public';
ALTER FUNCTION public.update_admin_role(uuid, text) SET search_path = 'public';
ALTER FUNCTION public.is_admin() SET search_path = 'public';

-- 4. SECURITY HARDENING: Restrict public access to sensitive tables
-- Fix customers table - should not be publicly readable
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view all customers" ON customers;
CREATE POLICY "Admins can manage customers" ON customers FOR ALL USING (is_admin());
CREATE POLICY "Service roles can manage customers" ON customers FOR ALL USING (auth.role() = 'service_role');

-- Fix business_settings table - should not be publicly readable
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view business settings" ON business_settings;
CREATE POLICY "Public can view basic business info" ON business_settings 
FOR SELECT USING (setting_key IN ('business_name', 'business_email', 'business_phone', 'business_address'));
CREATE POLICY "Admins can manage business settings" ON business_settings FOR ALL USING (is_admin());

-- Fix delivery_zones table - limit public access
DROP POLICY IF EXISTS "Public can view delivery zones" ON delivery_zones;
CREATE POLICY "Public can view active delivery zones" ON delivery_zones 
FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage delivery zones" ON delivery_zones FOR ALL USING (is_admin());

-- Fix delivery_fees table - limit public access  
DROP POLICY IF EXISTS "Public can view delivery fees" ON delivery_fees;
CREATE POLICY "Public can view active delivery fees" ON delivery_fees 
FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage delivery fees" ON delivery_fees FOR ALL USING (is_admin());

-- 5. Fix products table image reference issue
-- Ensure products table uses image_url not images column
-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_products_image_url ON products(image_url);

-- 6. Create a fixed function for order details that uses correct column
CREATE OR REPLACE FUNCTION public.get_order_details_with_items(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_order_data jsonb;
  v_items_data jsonb;
  v_result jsonb;
BEGIN
  -- Get order data
  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'customer_id', o.customer_id,
    'customer_name', o.customer_name,
    'customer_email', o.customer_email,
    'customer_phone', o.customer_phone,
    'order_type', o.order_type,
    'status', o.status,
    'payment_status', o.payment_status,
    'total_amount', o.total_amount,
    'delivery_address', o.delivery_address,
    'special_instructions', o.special_instructions,
    'order_time', o.order_time,
    'created_at', o.created_at,
    'updated_at', o.updated_at
  ) INTO v_order_data
  FROM orders o
  WHERE o.id = p_order_id;
  
  -- Get items data with correct image_url reference
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', oi.id,
      'product_id', oi.product_id,
      'product_name', oi.product_name,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price,
      'total_price', oi.total_price,
      'special_instructions', oi.special_instructions,
      'customizations', oi.customizations,
      'discount_amount', oi.discount_amount,
      'vat_amount', oi.vat_amount,
      'product', jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'description', p.description,
        'category', p.category,
        'image_url', p.image_url,  -- FIXED: use image_url not images
        'is_available', p.is_available,
        'price', p.price
      )
    )
  ) INTO v_items_data
  FROM order_items oi
  LEFT JOIN products p ON oi.product_id = p.id
  WHERE oi.order_id = p_order_id;
  
  -- Combine order and items data
  v_result := v_order_data || jsonb_build_object('items', COALESCE(v_items_data, '[]'::jsonb));
  
  RETURN v_result;
END;
$$;