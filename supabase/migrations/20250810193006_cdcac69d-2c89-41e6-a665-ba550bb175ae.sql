-- 1) Handle existing duplicates: orders.order_number
WITH duplicates AS (
  SELECT id, order_number,
         ROW_NUMBER() OVER (PARTITION BY order_number ORDER BY created_at) AS rn
  FROM public.orders 
  WHERE order_number IS NOT NULL
    AND order_number IN (
      SELECT order_number 
      FROM public.orders 
      WHERE order_number IS NOT NULL
      GROUP BY order_number 
      HAVING COUNT(*) > 1
    )
)
UPDATE public.orders o
SET order_number = o.order_number || '-DUP' || (d.rn - 1)
FROM duplicates d
WHERE o.id = d.id AND d.rn > 1;

-- 1b) Handle existing duplicates: payment_transactions.provider_reference
WITH dup_tx AS (
  SELECT id, provider_reference,
         ROW_NUMBER() OVER (PARTITION BY provider_reference ORDER BY created_at) AS rn
  FROM public.payment_transactions
  WHERE provider_reference IS NOT NULL
    AND provider_reference IN (
      SELECT provider_reference 
      FROM public.payment_transactions 
      WHERE provider_reference IS NOT NULL
      GROUP BY provider_reference 
      HAVING COUNT(*) > 1
    )
)
UPDATE public.payment_transactions t
SET provider_reference = t.provider_reference || '-DUP' || (x.rn - 1)
FROM dup_tx x
WHERE t.id = x.id AND x.rn > 1;

-- 2) Create sequence-based order number generator
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    date_prefix TEXT;
    sequence_num BIGINT;
    order_num TEXT;
BEGIN
    date_prefix := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-';
    sequence_num := nextval('public.order_number_seq');
    order_num := date_prefix || LPAD(sequence_num::TEXT, 4, '0');
    RETURN order_num;
END;
$$;

-- 3) Update create_order_with_items RPC to use the new generator
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_customer_id uuid,
  p_fulfillment_type text,
  p_delivery_address jsonb DEFAULT NULL::jsonb,
  p_pickup_point_id uuid DEFAULT NULL::uuid,
  p_delivery_zone_id uuid DEFAULT NULL::uuid,
  p_guest_session_id uuid DEFAULT NULL::uuid,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_customer_record RECORD;
  v_pickup_point_record RECORD;
  v_item jsonb;
  v_total_amount numeric := 0;
  v_item_count integer := 0;
  v_product_record RECORD;
  v_item_total numeric;
  v_bundle_item jsonb;
  v_is_custom_bundle boolean;
BEGIN
  -- Input validation
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer ID is required';
  END IF;
  
  IF p_fulfillment_type IS NULL OR p_fulfillment_type NOT IN ('delivery', 'pickup') THEN
    RAISE EXCEPTION 'Invalid fulfillment type. Must be "delivery" or "pickup"';
  END IF;
  
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;
  
  RAISE NOTICE 'Starting order creation for customer: %', p_customer_id;
  
  -- Validate customer exists
  SELECT * INTO v_customer_record
  FROM customer_accounts
  WHERE id = p_customer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer with ID % not found', p_customer_id;
  END IF;
  
  RAISE NOTICE 'Customer found: % (%)', v_customer_record.name, v_customer_record.email;
  
  -- Validate pickup point if required
  IF p_fulfillment_type = 'pickup' THEN
    IF p_pickup_point_id IS NULL THEN
      RAISE EXCEPTION 'Pickup point ID is required for pickup orders';
    END IF;
    
    SELECT * INTO v_pickup_point_record
    FROM pickup_points
    WHERE id = p_pickup_point_id AND is_active = true;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Active pickup point with ID % not found', p_pickup_point_id;
    END IF;
    
    RAISE NOTICE 'Pickup point validated: %', v_pickup_point_record.name;
  END IF;
  
  -- Validate delivery requirements
  IF p_fulfillment_type = 'delivery' THEN
    IF p_delivery_address IS NULL THEN
      RAISE EXCEPTION 'Delivery address is required for delivery orders';
    END IF;
    
    IF p_delivery_zone_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM delivery_zones WHERE id = p_delivery_zone_id) THEN
        RAISE EXCEPTION 'Delivery zone with ID % not found', p_delivery_zone_id;
      END IF;
      RAISE NOTICE 'Delivery zone validated: %', p_delivery_zone_id;
    END IF;
  END IF;
  
  -- Validate and calculate items total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_count := v_item_count + 1;
    
    -- Validate required item fields
    IF NOT (v_item ? 'product_id' AND v_item ? 'quantity' AND v_item ? 'unit_price') THEN
      RAISE EXCEPTION 'Item % missing required fields (product_id, quantity, unit_price)', v_item_count;
    END IF;
    
    -- Check if this is a custom bundle (product_id is not a valid UUID)
    v_is_custom_bundle := false;
    BEGIN
      -- Try to cast to UUID, if it fails, it's a custom bundle
      PERFORM (v_item->>'product_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_is_custom_bundle := true;
    END;
    
    IF v_is_custom_bundle THEN
      -- For custom bundles, validate that customization_items exist and have valid product IDs
      IF NOT (v_item ? 'customization_items') THEN
        RAISE EXCEPTION 'Custom bundle missing customization_items';
      END IF;
      
      -- Validate each item in the bundle
      FOR v_bundle_item IN SELECT * FROM jsonb_array_elements(v_item->'customization_items')
      LOOP
        SELECT * INTO v_product_record
        FROM products
        WHERE id = (v_bundle_item->>'id')::uuid;
        
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Product with ID % not found in bundle', v_bundle_item->>'id';
        END IF;
      END LOOP;
      
      RAISE NOTICE 'Custom bundle validated with % items', jsonb_array_length(v_item->'customization_items');
    ELSE
      -- Validate regular product exists
      SELECT * INTO v_product_record
      FROM products
      WHERE id = (v_item->>'product_id')::uuid;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product with ID % not found', v_item->>'product_id';
      END IF;
      
      RAISE NOTICE 'Product validated: %', v_product_record.name;
    END IF;
    
    -- Calculate item total
    v_item_total := (v_item->>'quantity')::integer * (v_item->>'unit_price')::numeric;
    v_total_amount := v_total_amount + v_item_total;
    
    RAISE NOTICE 'Item total calculated: %', v_item_total;
  END LOOP;
  
  RAISE NOTICE 'Order validation complete. Total items: %, Total amount: %', v_item_count, v_total_amount;
  
  -- Generate unique order number using sequence-based generator
  v_order_number := public.generate_order_number();
  
  RAISE NOTICE 'Generated order number: %', v_order_number;
  
  -- Create the order
  INSERT INTO orders (
    order_number,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    order_type,
    delivery_address,
    pickup_point_id,
    delivery_zone_id,
    guest_session_id,
    total_amount,
    payment_method,
    payment_status,
    status,
    order_time,
    created_at,
    updated_at
  ) VALUES (
    v_order_number,
    p_customer_id,
    v_customer_record.name,
    v_customer_record.email,
    v_customer_record.phone,
    p_fulfillment_type::order_type,
    p_delivery_address,
    p_pickup_point_id,
    p_delivery_zone_id,
    p_guest_session_id,
    v_total_amount,
    'pending',
    'pending',
    'pending',
    now(),
    now(),
    now()
  ) RETURNING id INTO v_order_id;
  
  RAISE NOTICE 'Order created with ID: %', v_order_id;
  
  -- Insert order items (handle both regular products and custom bundles)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Check if this is a custom bundle
    v_is_custom_bundle := false;
    BEGIN
      PERFORM (v_item->>'product_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_is_custom_bundle := true;
    END;
    
    IF v_is_custom_bundle THEN
      -- For custom bundles, insert each individual item
      FOR v_bundle_item IN SELECT * FROM jsonb_array_elements(v_item->'customization_items')
      LOOP
        INSERT INTO order_items (
          order_id,
          product_id,
          product_name,
          quantity,
          unit_price,
          total_price,
          discount_amount,
          customizations
        ) VALUES (
          v_order_id,
          (v_bundle_item->>'id')::uuid,
          v_bundle_item->>'name',
          (v_bundle_item->>'quantity')::integer,
          (v_bundle_item->>'price')::numeric,
          (v_bundle_item->>'quantity')::integer * (v_bundle_item->>'price')::numeric,
          COALESCE((v_bundle_item->>'discount_amount')::numeric, 0),
          jsonb_build_object(
            'bundle_id', v_item->>'product_id',
            'bundle_name', v_item->>'product_name',
            'is_bundle_item', true
          )
        );
      END LOOP;
      
      RAISE NOTICE 'Custom bundle items inserted for bundle: %', v_item->>'product_id';
    ELSE
      -- Insert regular product
      INSERT INTO order_items (
        order_id,
        product_id,
        product_name,
        quantity,
        unit_price,
        total_price,
        discount_amount
      ) VALUES (
        v_order_id,
        (v_item->>'product_id')::uuid,
        (SELECT name FROM products WHERE id = (v_item->>'product_id')::uuid),
        (v_item->>'quantity')::integer,
        (v_item->>'unit_price')::numeric,
        (v_item->>'quantity')::integer * (v_item->>'unit_price')::numeric,
        COALESCE((v_item->>'discount_amount')::numeric, 0)
      );
      
      RAISE NOTICE 'Regular product item inserted: %', v_item->>'product_id';
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Order items inserted successfully for order: %', v_order_id;
  
  -- Log successful order creation
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'order_created_v4_with_bundles',
    'Order Management',
    'Order created successfully with bundle support: ' || v_order_number,
    jsonb_build_object(
      'order_id', v_order_id,
      'order_number', v_order_number,
      'customer_id', p_customer_id,
      'fulfillment_type', p_fulfillment_type,
      'total_amount', v_total_amount,
      'item_count', v_item_count,
      'has_custom_bundles', EXISTS(
        SELECT 1 FROM jsonb_array_elements(p_items) AS item
        WHERE NOT (item->>'product_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      )
    )
  );
  
  RETURN v_order_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO audit_logs (
      action,
      category,
      message,
      new_values
    ) VALUES (
      'order_creation_failed_v4_bundles',
      'Order Management',
      'Order creation failed with bundle support: ' || SQLERRM,
      jsonb_build_object(
        'customer_id', p_customer_id,
        'fulfillment_type', p_fulfillment_type,
        'error', SQLERRM,
        'sqlstate', SQLSTATE
      )
    );
    
    -- Re-raise the exception
    RAISE;
END;
$function$;

-- 4) Create unique and performance indexes (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'idx_orders_order_number_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_orders_order_number_unique ON public.orders(order_number);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'idx_payment_transactions_provider_reference_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_payment_transactions_provider_reference_unique 
    ON public.payment_transactions(provider_reference);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'idx_orders_payment_reference'
  ) THEN
    CREATE INDEX idx_orders_payment_reference ON public.orders(payment_reference);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'idx_payment_transactions_order_id'
  ) THEN
    CREATE INDEX idx_payment_transactions_order_id ON public.payment_transactions(order_id);
  END IF;
END $$;