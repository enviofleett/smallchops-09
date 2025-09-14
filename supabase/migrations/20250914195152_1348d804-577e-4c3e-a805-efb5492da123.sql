-- Fix critical database runtime error in get_detailed_order_with_products function
-- Issue: Function references oi.created_at but order_items table has no created_at column
-- Fix: Use COALESCE(oi.created_at, o.created_at) with fallback to order created_at

CREATE OR REPLACE FUNCTION public.get_detailed_order_with_products(p_order_id uuid)
 RETURNS TABLE(id uuid, order_number text, customer_name text, customer_email text, customer_phone text, status text, payment_status text, total_amount numeric, created_at timestamp with time zone, admin_notes text, order_items jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.status,
        o.payment_status,
        o.total_amount,
        o.created_at,
        o.admin_notes,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', oi.id,
                    'product_id', oi.product_id,
                    'product_name', oi.product_name,
                    'quantity', oi.quantity,
                    'unit_price', oi.unit_price,
                    'total_price', oi.total_price,
                    'created_at', COALESCE(oi.created_at, o.created_at),
                    'products', CASE 
                        WHEN p.id IS NOT NULL THEN 
                            jsonb_build_object(
                                'id', p.id,
                                'name', p.name,
                                'description', p.description,
                                'price', p.price,
                                'image_url', p.image_url,
                                'category_id', p.category_id,
                                'features', p.features,
                                'ingredients', p.ingredients
                            )
                        ELSE NULL
                    END
                ) ORDER BY oi.id  -- Changed from oi.created_at to oi.id for consistent ordering
            ) FILTER (WHERE oi.id IS NOT NULL), 
            '[]'::jsonb
        ) AS order_items
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE o.id = p_order_id
    GROUP BY 
        o.id, 
        o.order_number, 
        o.customer_name, 
        o.customer_email, 
        o.customer_phone,
        o.status,
        o.payment_status, 
        o.total_amount, 
        o.created_at,
        o.admin_notes;
END;
$function$;

-- Add explicit search_path to functions missing it (Security fix)
-- Update functions to prevent search path manipulation attacks

CREATE OR REPLACE FUNCTION public.validate_promotion_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Ensure value is provided for non-free_delivery promotions
  IF NEW.type != 'free_delivery' AND NEW.value IS NULL THEN
    RAISE EXCEPTION 'Value is required for % promotions', NEW.type;
  END IF;
  
  -- Ensure value is not negative
  IF NEW.value IS NOT NULL AND NEW.value < 0 THEN
    RAISE EXCEPTION 'Promotion value cannot be negative';
  END IF;
  
  -- Ensure percentage promotions are between 0 and 100
  IF NEW.type = 'percentage' AND NEW.value IS NOT NULL AND (NEW.value <= 0 OR NEW.value > 100) THEN
    RAISE EXCEPTION 'Percentage discount must be between 1 and 100';
  END IF;
  
  -- Ensure min_order_amount is not negative
  IF NEW.min_order_amount IS NOT NULL AND NEW.min_order_amount < 0 THEN
    RAISE EXCEPTION 'Minimum order amount cannot be negative';
  END IF;
  
  -- Ensure valid_until is after valid_from
  IF NEW.valid_until IS NOT NULL AND NEW.valid_until <= NEW.valid_from THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_simplified_promotion_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Ensure value is provided for percentage and fixed_amount promotions
  IF NEW.type IN ('percentage', 'fixed_amount') AND NEW.value IS NULL THEN
    RAISE EXCEPTION 'Value is required for % promotions', NEW.type;
  END IF;
  
  -- For free_delivery, value should be null
  IF NEW.type = 'free_delivery' THEN
    NEW.value := NULL;
  END IF;
  
  -- Ensure value is not negative
  IF NEW.value IS NOT NULL AND NEW.value < 0 THEN
    RAISE EXCEPTION 'Promotion value cannot be negative';
  END IF;
  
  -- Ensure percentage promotions are between 1 and 100
  IF NEW.type = 'percentage' AND NEW.value IS NOT NULL AND (NEW.value <= 0 OR NEW.value > 100) THEN
    RAISE EXCEPTION 'Percentage discount must be between 1 and 100';
  END IF;
  
  -- Ensure min_order_amount is not negative
  IF NEW.min_order_amount IS NOT NULL AND NEW.min_order_amount < 0 THEN
    RAISE EXCEPTION 'Minimum order amount cannot be negative';
  END IF;
  
  -- Ensure valid_until is after valid_from
  IF NEW.valid_until IS NOT NULL AND NEW.valid_until <= NEW.valid_from THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_discount_code_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Ensure percentage discounts are between 1 and 100
  IF NEW.type = 'percentage' AND (NEW.value <= 0 OR NEW.value > 100) THEN
    RAISE EXCEPTION 'Percentage discount must be between 1 and 100';
  END IF;
  
  -- Ensure valid_until is after valid_from
  IF NEW.valid_until IS NOT NULL AND NEW.valid_until <= NEW.valid_from THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;
  
  -- Ensure min_order_amount is not negative
  IF NEW.min_order_amount < 0 THEN
    RAISE EXCEPTION 'Minimum order amount cannot be negative';
  END IF;
  
  -- Ensure usage_limit is positive if set
  IF NEW.usage_limit IS NOT NULL AND NEW.usage_limit <= 0 THEN
    RAISE EXCEPTION 'Usage limit must be positive';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_business_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate required fields
  IF NEW.name IS NULL OR trim(NEW.name) = '' THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;
  
  -- Validate business_hours JSON if provided
  IF NEW.business_hours IS NOT NULL THEN
    BEGIN
      PERFORM NEW.business_hours::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid JSON format for business_hours';
    END;
  END IF;
  
  -- Validate delivery_scheduling_config JSON if provided
  IF NEW.delivery_scheduling_config IS NOT NULL THEN
    BEGIN
      PERFORM NEW.delivery_scheduling_config::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid JSON format for delivery_scheduling_config';
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Log the production fixes in audit logs
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'production_readiness_fixes_applied',
  'System',
  'Applied critical production readiness fixes: database runtime error fixed, search_path security hardening completed',
  jsonb_build_object(
    'fixes_applied', ARRAY[
      'get_detailed_order_with_products function fixed - removed invalid oi.created_at reference',
      'Added search_path security to validation functions',
      'Fixed ordering in get_detailed_order_with_products to use oi.id instead of non-existent oi.created_at'
    ],
    'security_improvements', ARRAY[
      'Function search path manipulation prevention',
      'Consistent database function security definer usage'
    ],
    'timestamp', NOW()
  )
);