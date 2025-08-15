-- Critical Security Fixes for Database Functions and Views

-- 1. Fix security definer functions by adding search_path
CREATE OR REPLACE FUNCTION public.handle_successful_payment(p_paystack_reference text, p_order_reference text DEFAULT NULL::text, p_amount numeric DEFAULT 0, p_currency text DEFAULT 'NGN'::text, p_paystack_data jsonb DEFAULT '{}'::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  v_result JSON;
  v_order_id UUID;
  v_order_exists BOOLEAN;
  v_already_paid BOOLEAN;
  v_payment_exists BOOLEAN;
BEGIN
  RAISE NOTICE 'Processing payment: paystack_ref=%, order_ref=%, amount=%', 
    p_paystack_reference, p_order_reference, p_amount;

  -- Find order by EITHER reference format
  SELECT id INTO v_order_id
  FROM orders 
  WHERE 
    payment_reference = p_order_reference 
    OR paystack_reference = p_paystack_reference
    OR payment_reference = p_paystack_reference
    OR id = p_order_reference::UUID
  LIMIT 1;

  -- If not found by reference, try to match by amount and recent timestamp
  IF v_order_id IS NULL AND p_amount > 0 THEN
    SELECT id INTO v_order_id
    FROM orders 
    WHERE 
      total_amount = p_amount 
      AND payment_status = 'pending'
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Check if order exists
  IF v_order_id IS NULL THEN
    RAISE NOTICE 'Order not found for payment: %', p_paystack_reference;
    
    -- Create orphaned payment record
    INSERT INTO payment_transactions (
      provider_reference, 
      amount, 
      currency, 
      status, 
      gateway_response,
      created_at
    ) VALUES (
      p_paystack_reference,
      p_amount,
      p_currency,
      'orphaned',
      'No matching order found for payment',
      NOW()
    );
    
    RETURN json_build_object(
      'success', false,
      'error', 'Order not found',
      'code', 'ORDER_NOT_FOUND',
      'reference', p_paystack_reference
    );
  END IF;
  
  -- Check if payment already processed (idempotency)
  SELECT EXISTS(
    SELECT 1 FROM payment_transactions 
    WHERE provider_reference = p_paystack_reference 
    AND status IN ('paid', 'success', 'completed')
  ) INTO v_already_paid;
  
  IF v_already_paid THEN
    RAISE NOTICE 'Payment already processed: %', p_paystack_reference;
    RETURN json_build_object(
      'success', true,
      'message', 'Payment already processed',
      'code', 'ALREADY_PROCESSED',
      'order_id', v_order_id,
      'reference', p_paystack_reference
    );
  END IF;
  
  -- Begin transaction for atomic updates
  BEGIN
    -- Update order with Paystack reference if missing
    UPDATE orders 
    SET 
      paystack_reference = p_paystack_reference,
      reference_updated_at = NOW()
    WHERE id = v_order_id AND paystack_reference IS NULL;

    -- Insert/Update payment transaction record
    INSERT INTO payment_transactions (
      order_id,
      provider_reference,
      amount,
      currency,
      status,
      provider_response,
      paid_at,
      processed_at,
      created_at
    ) VALUES (
      v_order_id,
      p_paystack_reference,
      p_amount,
      p_currency,
      'paid',
      p_paystack_data,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (provider_reference) 
    DO UPDATE SET 
      status = 'paid',
      amount = p_amount,
      processed_at = NOW(),
      provider_response = p_paystack_data;
    
    -- Update order status to completed
    UPDATE orders 
    SET 
      status = 'confirmed',
      payment_status = 'paid',
      paid_at = NOW(),
      updated_at = NOW()
    WHERE id = v_order_id;
    
    RAISE NOTICE 'Payment processed successfully: order_id=%, reference=%', 
      v_order_id, p_paystack_reference;
    
    -- Return success
    RETURN json_build_object(
      'success', true,
      'order_id', v_order_id,
      'reference', p_paystack_reference,
      'message', 'Payment processed successfully'
    );
    
  EXCEPTION 
    WHEN unique_violation THEN
      -- Handle duplicate key violations gracefully
      RAISE NOTICE 'Duplicate payment processing attempted: %', p_paystack_reference;
      RETURN json_build_object(
        'success', true,
        'message', 'Payment already processed',
        'code', 'DUPLICATE_PROCESSING',
        'reference', p_paystack_reference
      );
    WHEN OTHERS THEN
      -- Return detailed error for debugging
      RAISE NOTICE 'Payment processing error: % - %', SQLSTATE, SQLERRM;
      RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'code', SQLSTATE,
        'reference', p_paystack_reference,
        'order_id', v_order_id
      );
  END;
END;
$function$;

-- 2. Add indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_orders_customer_email_status ON orders(customer_email, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id_created_at ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_product ON order_items(order_id, product_id);
CREATE INDEX IF NOT EXISTS idx_order_delivery_schedule_order_id ON order_delivery_schedule(order_id);

-- 3. Create optimized function for detailed order data
CREATE OR REPLACE FUNCTION public.get_detailed_order_with_products(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_order_data jsonb;
  v_items_data jsonb;
  v_delivery_data jsonb;
BEGIN
  -- Check if user can access this order
  IF NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = p_order_id
    AND (
      public.is_admin() 
      OR (o.customer_id IN (SELECT ca.id FROM customer_accounts ca WHERE ca.user_id = auth.uid()))
      OR (lower(o.customer_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())))
    )
  ) THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  -- Get order data
  SELECT to_jsonb(o.*) INTO v_order_data
  FROM orders o
  WHERE o.id = p_order_id;

  -- Get order items with product details
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', oi.id,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price,
      'total_price', oi.total_price,
      'product_name', oi.product_name,
      'special_instructions', oi.special_instructions,
      'customizations', oi.customizations,
      'discount_amount', oi.discount_amount,
      'vat_amount', oi.vat_amount,
      'product', jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'description', p.description,
        'images', p.images,
        'is_available', p.is_available,
        'price', p.price
      )
    )
  ) INTO v_items_data
  FROM order_items oi
  LEFT JOIN products p ON oi.product_id = p.id
  WHERE oi.order_id = p_order_id;

  -- Get delivery schedule if exists
  SELECT to_jsonb(ods.*) INTO v_delivery_data
  FROM order_delivery_schedule ods
  WHERE ods.order_id = p_order_id;

  -- Combine all data
  v_result := jsonb_build_object(
    'order', v_order_data,
    'items', COALESCE(v_items_data, '[]'::jsonb),
    'delivery_schedule', v_delivery_data
  );

  RETURN v_result;
END;
$function$;