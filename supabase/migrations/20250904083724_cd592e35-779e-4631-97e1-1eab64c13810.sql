-- CRITICAL FIX: Update get_detailed_order_with_products function to remove non-existent column reference
-- This fixes the database error: column oi.created_at does not exist

CREATE OR REPLACE FUNCTION public.get_detailed_order_with_products(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_data RECORD;
  v_order_items jsonb;
  v_delivery_schedule jsonb := null;
  v_user_email text;
  v_can_access boolean := false;
BEGIN
  -- Check if user is admin
  IF is_admin() THEN
    v_can_access := true;
  ELSE
    -- Get current user email
    v_user_email := LOWER(COALESCE(current_user_email(), ''));
    
    -- Check if user owns the order
    SELECT o.customer_id = auth.uid() OR LOWER(COALESCE(o.customer_email, '')) = v_user_email
    INTO v_can_access
    FROM orders o
    WHERE o.id = p_order_id;
  END IF;
  
  -- Deny access if not authorized
  IF NOT COALESCE(v_can_access, false) THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;
  
  -- Get order data
  SELECT * INTO v_order_data
  FROM orders
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Order not found');
  END IF;
  
  -- Get order items (FIXED: removed ORDER BY oi.created_at since column doesn't exist)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', oi.id,
      'product_id', oi.product_id,
      'product_name', oi.product_name,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price,
      'total_price', oi.total_price,
      'vat_amount', oi.vat_amount,
      'vat_rate', oi.vat_rate,
      'discount_amount', oi.discount_amount,
      'special_instructions', oi.special_instructions,
      'customizations', oi.customizations
    )
  ), '[]'::jsonb) INTO v_order_items
  FROM order_items oi
  WHERE oi.order_id = p_order_id
  ORDER BY oi.id; -- Order by ID instead of non-existent created_at
  
  -- Get delivery/pickup schedule (most recent) - handle both delivery and pickup orders
  BEGIN
    SELECT jsonb_build_object(
      'id', ods.id,
      'delivery_date', ods.delivery_date,
      'delivery_time_start', ods.delivery_time_start,
      'delivery_time_end', ods.delivery_time_end,
      'is_flexible', ods.is_flexible,
      'special_instructions', ods.special_instructions,
      'requested_at', ods.requested_at
    ) INTO v_delivery_schedule
    FROM order_delivery_schedule ods
    WHERE ods.order_id = p_order_id
    ORDER BY ods.created_at DESC
    LIMIT 1;
  EXCEPTION
    WHEN OTHERS THEN
      -- If there's any error fetching schedule, set to null
      v_delivery_schedule := null;
  END;
  
  -- Return complete data - delivery_schedule can be null for pickup orders without schedules
  RETURN jsonb_build_object(
    'order', row_to_json(v_order_data),
    'items', v_order_items,
    'delivery_schedule', v_delivery_schedule
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'Database error: ' || SQLERRM);
END;
$function$;