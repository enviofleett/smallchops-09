-- Fix the create_order_with_items function to work with customer_accounts table
-- This resolves the foreign key constraint violation

DROP FUNCTION IF EXISTS create_order_with_items(text, text, jsonb, text, text, jsonb, text, text, uuid, numeric, numeric);

CREATE OR REPLACE FUNCTION create_order_with_items(
  p_customer_email text,
  p_customer_name text,
  p_items jsonb,
  p_customer_phone text DEFAULT NULL,
  p_fulfillment_type text DEFAULT 'delivery',
  p_delivery_address jsonb DEFAULT NULL,
  p_guest_session_id text DEFAULT NULL,
  p_payment_method text DEFAULT 'cash',
  p_delivery_zone_id uuid DEFAULT NULL,
  p_delivery_fee numeric DEFAULT 0,
  p_total_amount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_account_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_user_id uuid;
  v_item jsonb;
  v_result jsonb;
BEGIN
  -- Generate unique order number
  v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(floor(random() * 10000)::text, 4, '0');
  
  -- Try to find existing customer_account by email
  SELECT ca.id, ca.user_id INTO v_customer_account_id, v_user_id
  FROM customer_accounts ca
  WHERE ca.email = p_customer_email
  LIMIT 1;
  
  -- If no customer_account found, create one
  IF v_customer_account_id IS NULL THEN
    -- For guest users, user_id will be NULL
    -- For authenticated users, this would be set by the calling code
    
    INSERT INTO customer_accounts (
      name,
      email,
      phone,
      user_id,
      email_verified,
      created_at,
      updated_at
    ) VALUES (
      p_customer_name,
      p_customer_email,
      p_customer_phone,
      NULL, -- user_id is NULL for guest checkouts
      false,
      now(),
      now()
    ) RETURNING id INTO v_customer_account_id;
    
    -- Log customer account creation
    INSERT INTO audit_logs (
      action,
      category,
      message,
      new_values
    ) VALUES (
      'guest_customer_account_created',
      'Customer Management',
      'Guest customer account created during checkout: ' || p_customer_email,
      jsonb_build_object(
        'customer_account_id', v_customer_account_id,
        'email', p_customer_email,
        'name', p_customer_name,
        'phone', p_customer_phone
      )
    );
  END IF;
  
  -- Create the order using the customer_account_id
  INSERT INTO orders (
    order_number,
    customer_id, -- This now references customer_accounts.id
    customer_name,
    customer_email,
    customer_phone,
    order_type,
    delivery_address,
    total_amount,
    delivery_fee,
    payment_method,
    payment_status,
    status,
    delivery_zone_id,
    guest_session_id,
    order_time,
    created_at,
    updated_at
  ) VALUES (
    v_order_number,
    v_customer_account_id, -- Use customer_accounts.id
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_fulfillment_type,
    p_delivery_address,
    p_total_amount,
    p_delivery_fee,
    p_payment_method,
    'pending',
    'pending',
    p_delivery_zone_id,
    p_guest_session_id::uuid,
    now(),
    now(),
    now()
  ) RETURNING id INTO v_order_id;
  
  -- Insert order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id,
      product_id,
      quantity,
      unit_price,
      total_price,
      discount_amount,
      created_at
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::integer * (v_item->>'unit_price')::numeric,
      COALESCE((v_item->>'discount_amount')::numeric, 0),
      now()
    );
  END LOOP;
  
  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'customer_account_id', v_customer_account_id,
    'message', 'Order created successfully'
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN foreign_key_violation THEN
    -- Log the foreign key error
    INSERT INTO audit_logs (
      action,
      category,
      message,
      new_values
    ) VALUES (
      'order_creation_foreign_key_error',
      'Order Management',
      'Foreign key violation during order creation: ' || SQLERRM,
      jsonb_build_object(
        'customer_email', p_customer_email,
        'customer_name', p_customer_name,
        'error', SQLERRM
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Foreign key constraint violation',
      'message', 'Order creation failed: ' || SQLERRM
    );
    
  WHEN OTHERS THEN
    -- Log other errors
    INSERT INTO audit_logs (
      action,
      category,
      message,
      new_values
    ) VALUES (
      'order_creation_error',
      'Order Management',
      'Error during order creation: ' || SQLERRM,
      jsonb_build_object(
        'customer_email', p_customer_email,
        'customer_name', p_customer_name,
        'error', SQLERRM
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order creation failed',
      'message', 'Order creation failed: ' || SQLERRM
    );
END;
$$;