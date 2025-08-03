-- Phase 2: Core Functionality - Fix remaining function security and RLS policies (CONTINUED)

-- 1. Fix remaining database functions with proper security settings
CREATE OR REPLACE FUNCTION public.track_price_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only track if price actually changed
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO public.product_price_history (product_id, old_price, new_price, changed_by)
    VALUES (NEW.id, OLD.price, NEW.price, auth.uid());
    
    -- Queue price change notifications for customers who have this product in favorites
    INSERT INTO public.notification_queue (customer_id, product_id, notification_type, data)
    SELECT 
      cf.customer_id, 
      NEW.id, 
      'price_change',
      jsonb_build_object(
        'old_price', OLD.price,
        'new_price', NEW.price,
        'product_name', NEW.name,
        'percentage_change', ROUND(((NEW.price - OLD.price) / OLD.price * 100)::numeric, 2)
      )
    FROM public.customer_favorites cf
    INNER JOIN public.customer_notification_preferences cnp ON cf.customer_id = cnp.customer_id
    WHERE cf.product_id = NEW.id 
    AND cnp.price_alerts = true
    AND ABS((NEW.price - OLD.price) / OLD.price * 100) >= cnp.minimum_discount_percentage;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_customer_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update or insert customer analytics when order status changes to completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO public.customer_purchase_analytics (
      customer_email,
      total_orders,
      total_spent,
      average_order_value,
      last_purchase_date
    )
    SELECT 
      NEW.customer_email,
      COUNT(*),
      SUM(total_amount),
      AVG(total_amount),
      MAX(order_time)
    FROM public.orders 
    WHERE customer_email = NEW.customer_email 
    AND status = 'completed'
    ON CONFLICT (customer_email) 
    DO UPDATE SET
      total_orders = EXCLUDED.total_orders,
      total_spent = EXCLUDED.total_spent,
      average_order_value = EXCLUDED.average_order_value,
      last_purchase_date = EXCLUDED.last_purchase_date,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. Add missing RLS policies (skip existing ones)

-- Business settings - Admin management (skip if exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'business_settings' 
    AND policyname = 'Admins can manage business settings'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can manage business settings" ON public.business_settings FOR ALL USING (is_admin()) WITH CHECK (is_admin())';
  END IF;
END $$;

-- Customer addresses - Missing policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_addresses' 
    AND policyname = 'Admins can view all customer addresses'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can view all customer addresses" ON public.customer_addresses FOR SELECT USING (is_admin())';
  END IF;
END $$;

-- Customer notification channels - Missing policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customer_notification_channels' 
    AND policyname = 'Service roles can manage notification channels'
  ) THEN
    EXECUTE 'CREATE POLICY "Service roles can manage notification channels" ON public.customer_notification_channels FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;

-- Audit logs - Admin read access
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'audit_logs' 
    AND policyname = 'Service roles can insert audit logs'
  ) THEN
    EXECUTE 'CREATE POLICY "Service roles can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (auth.role() = ''service_role'' OR true)';
  END IF;
END $$;

-- 3. Create payment processing edge function for checkout
-- This will be handled in the next step since we need to set up the actual edge function

-- 4. Create order validation function
CREATE OR REPLACE FUNCTION public.validate_order_data(
  p_customer_email text,
  p_order_items jsonb,
  p_total_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item jsonb;
  v_product_exists boolean;
  v_calculated_total numeric := 0;
  v_errors text[] := '{}';
BEGIN
  -- Validate email
  IF p_customer_email IS NULL OR p_customer_email = '' THEN
    v_errors := array_append(v_errors, 'Customer email is required');
  END IF;
  
  -- Validate order items
  IF p_order_items IS NULL OR jsonb_array_length(p_order_items) = 0 THEN
    v_errors := array_append(v_errors, 'Order must contain at least one item');
  ELSE
    -- Validate each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
    LOOP
      -- Check if product exists
      SELECT EXISTS(SELECT 1 FROM public.products WHERE id = (v_item->>'product_id')::uuid) 
      INTO v_product_exists;
      
      IF NOT v_product_exists THEN
        v_errors := array_append(v_errors, 'Product not found: ' || (v_item->>'product_id'));
      ELSE
        -- Add to calculated total
        v_calculated_total := v_calculated_total + (v_item->>'total_price')::numeric;
      END IF;
      
      -- Validate quantity
      IF (v_item->>'quantity')::integer <= 0 THEN
        v_errors := array_append(v_errors, 'Invalid quantity for product: ' || (v_item->>'product_id'));
      END IF;
    END LOOP;
  END IF;
  
  -- Validate total amount
  IF ABS(v_calculated_total - p_total_amount) > 0.01 THEN
    v_errors := array_append(v_errors, 'Total amount mismatch: calculated ' || v_calculated_total || ', provided ' || p_total_amount);
  END IF;
  
  -- Return validation result
  IF array_length(v_errors, 1) > 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'errors', v_errors
    );
  ELSE
    RETURN jsonb_build_object(
      'valid', true,
      'calculated_total', v_calculated_total
    );
  END IF;
END;
$function$;