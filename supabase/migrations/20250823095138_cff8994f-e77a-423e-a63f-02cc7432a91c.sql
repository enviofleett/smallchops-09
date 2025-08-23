-- Create secure RPC function for detailed order data
CREATE OR REPLACE FUNCTION public.get_detailed_order_with_products(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_data RECORD;
  v_order_items jsonb;
  v_delivery_schedule jsonb;
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
  
  -- Get order items
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
  ORDER BY oi.created_at;
  
  -- Get delivery schedule (most recent)
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
  
  -- Return complete data
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

-- Enable RLS policies for order_items so customers can read their own items
-- Policy for customers to read their own order items
DROP POLICY IF EXISTS "Customers can view their own order items" ON order_items;
CREATE POLICY "Customers can view their own order items" 
ON order_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = order_items.order_id 
    AND (
      (auth.uid() IS NOT NULL AND o.customer_id = auth.uid()) OR
      (LOWER(COALESCE(current_user_email(), '')) = LOWER(COALESCE(o.customer_email, '')))
    )
  )
);

-- Policy for admins to view all order items
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
CREATE POLICY "Admins can view all order items" 
ON order_items 
FOR SELECT 
USING (is_admin());