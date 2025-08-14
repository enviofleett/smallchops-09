-- PHASE 1: FIX CRITICAL DATABASE SCHEMA ISSUES (FINAL)

-- 1. Fix RLS policy for performance_analytics table
DROP POLICY IF EXISTS "Service roles can insert performance analytics" ON performance_analytics;
CREATE POLICY "Service roles can insert performance analytics" 
ON performance_analytics FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

-- 2. Fix function search paths for security (addressing linter warnings)
ALTER FUNCTION public.log_profile_activity(uuid, text, text, text, text, inet, text) SET search_path = 'public';
ALTER FUNCTION public.create_logo_version(text, bigint, text, jsonb, uuid) SET search_path = 'public';
ALTER FUNCTION public.log_branding_change(text, text, text, text, jsonb, inet, text) SET search_path = 'public';
ALTER FUNCTION public.setup_admin_permissions(uuid) SET search_path = 'public';
ALTER FUNCTION public.handle_admin_signup() SET search_path = 'public';
ALTER FUNCTION public.manual_setup_store_admin() SET search_path = 'public';
ALTER FUNCTION public.update_payment_transaction_timestamp() SET search_path = 'public';
ALTER FUNCTION public.setup_hardcoded_admin() SET search_path = 'public';
ALTER FUNCTION public.setup_permissions_after_insert() SET search_path = 'public';
ALTER FUNCTION public.check_otp_rate_limit(text) SET search_path = 'public';

-- 3. Create production-safe error boundary function
CREATE OR REPLACE FUNCTION public.safe_get_order_details(p_order_id uuid)
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
  -- Get order data safely
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
  
  -- If no order found, return null
  IF v_order_data IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get items data with safe image reference (use image_url)
  SELECT COALESCE(jsonb_agg(
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
      'product', CASE 
        WHEN p.id IS NOT NULL THEN jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'description', p.description,
          'category', p.category,
          'image_url', COALESCE(p.image_url, ''),  -- Safe fallback
          'is_available', COALESCE(p.is_available, false),
          'price', COALESCE(p.price, 0)
        )
        ELSE '{}'::jsonb
      END
    )
  ), '[]'::jsonb) INTO v_items_data
  FROM order_items oi
  LEFT JOIN products p ON oi.product_id = p.id
  WHERE oi.order_id = p_order_id;
  
  -- Combine order and items data
  v_result := v_order_data || jsonb_build_object('items', v_items_data);
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return safe fallback
    INSERT INTO audit_logs (action, category, message) 
    VALUES ('order_details_error', 'Database', 'Error getting order details: ' || SQLERRM);
    RETURN jsonb_build_object('error', 'Unable to load order details');
END;
$$;