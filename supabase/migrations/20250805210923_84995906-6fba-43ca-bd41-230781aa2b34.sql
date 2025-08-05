-- CRITICAL PRODUCTION FIXES
-- Drop conflicting function versions
DROP FUNCTION IF EXISTS public.create_order_with_items(text, text, jsonb, text, text, jsonb, text, text);
DROP FUNCTION IF EXISTS public.create_order_with_items(text, text, jsonb, text, order_type, jsonb, uuid, text);

-- Ensure payment_transactions has all required fields
ALTER TABLE public.payment_transactions 
ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Fix function search paths for security
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_customer_email text, 
  p_customer_name text, 
  p_items jsonb,
  p_customer_phone text DEFAULT NULL,
  p_fulfillment_type text DEFAULT 'delivery',
  p_delivery_address jsonb DEFAULT NULL,
  p_guest_session_id text DEFAULT NULL,
  p_payment_method text DEFAULT 'paystack'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
    v_order_id uuid;
    v_item jsonb;
    v_product_record RECORD;
    v_subtotal numeric := 0;
    v_item_count integer := 0;
    v_order_number text;
BEGIN
    -- Input validation
    IF p_customer_email IS NULL OR LENGTH(TRIM(p_customer_email)) = 0 THEN
        RAISE EXCEPTION 'Customer email is required';
    END IF;
    
    IF p_customer_name IS NULL OR LENGTH(TRIM(p_customer_name)) = 0 THEN
        RAISE EXCEPTION 'Customer name is required';
    END IF;
    
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    -- Generate order number
    v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(EXTRACT(epoch FROM NOW())::text, 10, '0');

    -- Calculate subtotal
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Validate item structure
        IF NOT (v_item ? 'product_id' AND v_item ? 'quantity') THEN
            RAISE EXCEPTION 'Each item must have product_id and quantity';
        END IF;
        
        -- Get product details
        SELECT id, name, price INTO v_product_record
        FROM public.products 
        WHERE id = (v_item->>'product_id')::uuid 
        AND status = 'active';
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product with ID % not found or not active', v_item->>'product_id';
        END IF;
        
        v_subtotal := v_subtotal + (v_product_record.price * (v_item->>'quantity')::integer);
        v_item_count := v_item_count + 1;
    END LOOP;
    
    -- Create the order
    INSERT INTO public.orders (
        order_number,
        customer_email,
        customer_name,
        customer_phone,
        order_type,
        subtotal,
        total_amount,
        status,
        payment_status
    ) VALUES (
        v_order_number,
        p_customer_email,
        p_customer_name,
        p_customer_phone,
        p_fulfillment_type::order_type,
        v_subtotal,
        v_subtotal,
        'pending'::order_status,
        'pending'::payment_status
    ) RETURNING id INTO v_order_id;
    
    -- Insert order items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT price, name INTO v_product_record.price, v_product_record.name
        FROM public.products 
        WHERE id = (v_item->>'product_id')::uuid;
        
        INSERT INTO public.order_items (
            order_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total_price
        ) VALUES (
            v_order_id,
            (v_item->>'product_id')::uuid,
            v_product_record.name,
            (v_item->>'quantity')::integer,
            v_product_record.price,
            v_product_record.price * (v_item->>'quantity')::integer
        );
    END LOOP;
    
    -- Log order creation
    INSERT INTO public.audit_logs (action, category, message, new_values)
    VALUES (
        'order_created',
        'Order Management',
        'Order created successfully',
        jsonb_build_object(
            'order_id', v_order_id,
            'order_number', v_order_number,
            'customer_email', p_customer_email,
            'subtotal', v_subtotal,
            'item_count', v_item_count
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'subtotal', v_subtotal,
        'message', 'Order created successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO public.audit_logs (action, category, message, new_values)
        VALUES (
            'order_creation_failed',
            'Order Management',
            'Order creation failed: ' || SQLERRM,
            jsonb_build_object(
                'customer_email', p_customer_email,
                'error', SQLERRM
            )
        );
        RAISE;
END;
$$;

-- Fix other functions search paths
CREATE OR REPLACE FUNCTION public.confirm_payment_atomic(p_reference text, p_amount integer, p_paystack_data jsonb, p_confirmed_at timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_transaction_record RECORD;
  v_expected_amount INTEGER;
  v_result JSONB;
BEGIN
  BEGIN
    -- Get payment transaction details
    SELECT pt.*, o.total_amount as order_total
    INTO v_transaction_record
    FROM payment_transactions pt
    LEFT JOIN orders o ON pt.order_id = o.id
    WHERE pt.provider_reference = p_reference;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Transaction with reference % not found', p_reference;
    END IF;

    -- Calculate expected amount in kobo
    v_expected_amount := ROUND(v_transaction_record.amount * 100);

    -- Verify amount matches
    IF v_expected_amount != p_amount THEN
      INSERT INTO public.security_incidents (
        type,
        description,
        severity,
        reference,
        expected_amount,
        received_amount,
        request_data
      ) VALUES (
        'webhook_amount_mismatch',
        'Webhook amount mismatch detected',
        'critical',
        p_reference,
        v_expected_amount,
        p_amount,
        p_paystack_data
      );
      
      RAISE EXCEPTION 'Amount mismatch: expected %, received %', v_expected_amount, p_amount;
    END IF;

    -- Update payment transaction
    UPDATE payment_transactions 
    SET 
      status = 'success',
      provider_response = p_paystack_data,
      paid_at = p_confirmed_at,
      processed_at = NOW(),
      updated_at = NOW()
    WHERE provider_reference = p_reference;

    -- Update order if exists
    IF v_transaction_record.order_id IS NOT NULL THEN
      UPDATE orders 
      SET 
        payment_status = 'paid'::payment_status,
        status = 'processing'::order_status,
        updated_at = NOW()
      WHERE id = v_transaction_record.order_id;
    END IF;

    v_result := jsonb_build_object(
      'success', true,
      'transaction_id', v_transaction_record.id,
      'order_id', v_transaction_record.order_id,
      'confirmed_at', p_confirmed_at
    );

    RETURN v_result;

  EXCEPTION
    WHEN OTHERS THEN
      INSERT INTO public.security_incidents (
        type,
        description,
        severity,
        reference,
        error_message,
        request_data
      ) VALUES (
        'payment_confirmation_error',
        'Error during atomic payment confirmation',
        'high',
        p_reference,
        SQLERRM,
        p_paystack_data
      );
      
      RAISE;
  END;
END;
$$;