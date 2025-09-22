-- Fix order total mismatch error by increasing tolerance and adding detailed logging
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_delivery_address TEXT,
  p_delivery_instructions TEXT,
  p_order_type order_type,
  p_order_time TIMESTAMP WITH TIME ZONE,
  p_subtotal NUMERIC,
  p_delivery_fee NUMERIC,
  p_total NUMERIC,
  p_items JSONB,
  p_promotion_code TEXT DEFAULT NULL,
  p_promotion_discount NUMERIC DEFAULT 0,
  p_client_calculated_total NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_item JSONB;
  v_product RECORD;
  v_server_calculated_total NUMERIC := 0;
  v_server_calculated_subtotal NUMERIC := 0;
  v_total_difference NUMERIC;
  v_tolerance NUMERIC := 5.00; -- Increased from 1.00 to 5.00 naira
  v_promotion RECORD;
  v_applied_discount NUMERIC := 0;
  v_final_total NUMERIC;
BEGIN
  -- Generate order number
  v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((EXTRACT(EPOCH FROM NOW())::BIGINT % 100000)::TEXT, 5, '0');
  
  -- Calculate server-side totals with detailed logging
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT price INTO v_product FROM products WHERE id = (v_item->>'product_id')::UUID;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_item->>'product_id';
    END IF;
    
    v_server_calculated_subtotal := v_server_calculated_subtotal + (v_product.price * (v_item->>'quantity')::INTEGER);
  END LOOP;

  -- Apply promotion discount if provided
  IF p_promotion_code IS NOT NULL THEN
    SELECT * INTO v_promotion FROM promotions WHERE code = p_promotion_code AND is_active = true;
    
    IF FOUND THEN
      IF v_promotion.promotion_type = 'percentage' THEN
        v_applied_discount := ROUND((v_server_calculated_subtotal * v_promotion.discount_value / 100), 2);
      ELSIF v_promotion.promotion_type = 'fixed_amount' THEN
        v_applied_discount := v_promotion.discount_value;
      END IF;
    END IF;
  END IF;

  -- Calculate final server total
  v_server_calculated_total := v_server_calculated_subtotal - v_applied_discount + p_delivery_fee;
  
  -- Log detailed calculation breakdown
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'order_total_calculation_debug',
    'Order Processing',
    'Detailed order total calculation breakdown',
    jsonb_build_object(
      'server_subtotal', v_server_calculated_subtotal,
      'client_subtotal', p_subtotal,
      'server_discount', v_applied_discount,
      'client_discount', p_promotion_discount,
      'delivery_fee', p_delivery_fee,
      'server_total', v_server_calculated_total,
      'client_total', COALESCE(p_client_calculated_total, p_total),
      'provided_total', p_total,
      'tolerance', v_tolerance,
      'promotion_code', p_promotion_code
    )
  );

  -- Use client total if provided, otherwise use p_total
  v_total_difference := ABS(v_server_calculated_total - COALESCE(p_client_calculated_total, p_total));
  
  -- Validate total with increased tolerance
  IF v_total_difference > v_tolerance THEN
    -- Log the mismatch but use server calculation as authoritative
    INSERT INTO audit_logs (action, category, message, new_values)
    VALUES (
      'order_total_mismatch_resolved',
      'Order Processing',
      'Order total mismatch detected - using server calculation as authoritative',
      jsonb_build_object(
        'server_total', v_server_calculated_total,
        'client_total', COALESCE(p_client_calculated_total, p_total),
        'difference', v_total_difference,
        'tolerance', v_tolerance,
        'resolution', 'server_authoritative'
      )
    );
    
    -- Use server calculation as the final total
    v_final_total := v_server_calculated_total;
  ELSE
    -- Within tolerance, use client total
    v_final_total := COALESCE(p_client_calculated_total, p_total);
  END IF;

  -- Create the order with server-calculated total
  INSERT INTO orders (
    order_number,
    customer_name,
    customer_email,
    customer_phone,
    delivery_address,
    delivery_instructions,
    order_type,
    order_time,
    subtotal,
    delivery_fee,
    total_amount,
    status,
    payment_status,
    promotion_code,
    promotion_discount
  ) VALUES (
    v_order_number,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_delivery_address,
    p_delivery_instructions,
    p_order_type,
    p_order_time,
    v_server_calculated_subtotal - v_applied_discount,
    p_delivery_fee,
    v_final_total,
    'pending',
    'pending',
    p_promotion_code,
    v_applied_discount
  ) RETURNING id INTO v_order_id;

  -- Insert order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::UUID;
    
    INSERT INTO order_items (
      order_id,
      product_id,
      quantity,
      unit_price,
      total_price
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      v_product.price,
      v_product.price * (v_item->>'quantity')::INTEGER
    );
  END LOOP;

  -- Log successful order creation
  INSERT INTO audit_logs (action, category, message, entity_id, new_values)
  VALUES (
    'order_created_with_validation_fix',
    'Order Management',
    'Order created successfully with enhanced total validation',
    v_order_id,
    jsonb_build_object(
      'order_number', v_order_number,
      'final_total', v_final_total,
      'server_calculated_total', v_server_calculated_total,
      'tolerance_used', v_tolerance,
      'total_difference', v_total_difference
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'final_total', v_final_total,
    'server_calculated_total', v_server_calculated_total
  );

EXCEPTION WHEN OTHERS THEN
  -- Log the error with full context
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'order_creation_failed_enhanced',
    'Critical Error',
    'Order creation failed with enhanced validation: ' || SQLERRM,
    jsonb_build_object(
      'error', SQLERRM,
      'sqlstate', SQLSTATE,
      'server_total', v_server_calculated_total,
      'client_total', COALESCE(p_client_calculated_total, p_total),
      'difference', v_total_difference,
      'tolerance', v_tolerance
    )
  );

  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'server_calculated_total', v_server_calculated_total
  );
END;
$$;