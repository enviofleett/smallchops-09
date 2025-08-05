-- Fix the create_order_with_items function to handle enum casting properly
DROP FUNCTION IF EXISTS create_order_with_items(text, text, jsonb, text, jsonb, text, text, uuid);

CREATE OR REPLACE FUNCTION create_order_with_items(
  p_customer_email text,
  p_customer_name text,
  p_order_items jsonb,
  p_customer_phone text DEFAULT NULL,
  p_delivery_address jsonb DEFAULT NULL,
  p_fulfillment_type text DEFAULT 'delivery',
  p_payment_method text DEFAULT 'paystack',
  p_guest_session_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_order_id uuid;
    v_customer_id uuid;
    v_item jsonb;
    v_total_amount numeric := 0;
    v_result jsonb;
    v_order_type order_type;
BEGIN
    -- Enhanced logging for debugging
    RAISE LOG 'Order creation started for customer: %, fulfillment: %, session: %', 
        p_customer_email, p_fulfillment_type, p_guest_session_id;
    
    -- Validate required parameters
    IF p_customer_email IS NULL OR LENGTH(TRIM(p_customer_email)) = 0 THEN
        RAISE EXCEPTION 'Customer email is required' USING ERRCODE = 'P0001';
    END IF;
    
    IF p_customer_name IS NULL OR LENGTH(TRIM(p_customer_name)) = 0 THEN
        RAISE EXCEPTION 'Customer name is required' USING ERRCODE = 'P0001';
    END IF;
    
    IF p_order_items IS NULL OR jsonb_array_length(p_order_items) = 0 THEN
        RAISE EXCEPTION 'Order creation failed: Order items are required' USING ERRCODE = 'P0001';
    END IF;
    
    -- Validate and cast fulfillment_type to order_type enum
    BEGIN
        v_order_type := p_fulfillment_type::order_type;
        RAISE LOG 'Successfully cast fulfillment_type % to order_type enum', p_fulfillment_type;
    EXCEPTION 
        WHEN invalid_text_representation THEN
            RAISE EXCEPTION 'Order creation failed: Invalid fulfillment type: %. Allowed values are: delivery, pickup', 
                p_fulfillment_type USING ERRCODE = 'P0001';
        WHEN OTHERS THEN
            RAISE EXCEPTION 'Order creation failed: Error validating fulfillment type %: %', 
                p_fulfillment_type, SQLERRM USING ERRCODE = 'P0001';
    END;

    BEGIN
        -- Check for existing customer account first
        SELECT ca.id INTO v_customer_id
        FROM public.customer_accounts ca
        JOIN auth.users u ON ca.user_id = u.id
        WHERE u.email = p_customer_email;
        
        -- Calculate total amount
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
        LOOP
            v_total_amount := v_total_amount + ((v_item->>'price')::numeric * (v_item->>'quantity')::integer);
        END LOOP;
        
        RAISE LOG 'Calculated total amount: % for % items', v_total_amount, jsonb_array_length(p_order_items);
        
        -- Create order with correct column mapping and enum casting
        INSERT INTO public.orders (
            customer_id,
            customer_email,
            customer_name,
            customer_phone,
            order_type,  -- Use order_type column with proper enum value
            delivery_address,
            total_amount,
            status,
            payment_status,
            payment_method,
            guest_session_id,
            order_time,
            created_at,
            updated_at
        ) VALUES (
            v_customer_id,
            p_customer_email,
            p_customer_name,
            p_customer_phone,
            v_order_type,  -- Use the validated enum value
            p_delivery_address,
            v_total_amount,
            'pending'::order_status,  -- Cast to enum if status is also enum
            'pending'::payment_status,  -- Cast to enum if payment_status is also enum
            p_payment_method,
            p_guest_session_id,
            NOW(),
            NOW(),
            NOW()
        ) RETURNING id INTO v_order_id;
        
        RAISE LOG 'Order created with ID: %, order_type: %', v_order_id, v_order_type;
        
        -- Insert order items
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
        LOOP
            INSERT INTO public.order_items (
                order_id,
                product_id,
                quantity,
                price,
                total_price,
                created_at
            ) VALUES (
                v_order_id,
                (v_item->>'product_id')::uuid,
                (v_item->>'quantity')::integer,
                (v_item->>'price')::numeric,
                (v_item->>'price')::numeric * (v_item->>'quantity')::integer,
                NOW()
            );
        END LOOP;
        
        -- Queue welcome email for new guest customers (if no customer account exists)
        IF v_customer_id IS NULL THEN
            INSERT INTO public.communication_events (
                event_type,
                recipient_email,
                template_variables,
                status,
                priority,
                order_id,
                created_at
            ) VALUES (
                'order_confirmation',
                p_customer_email,
                jsonb_build_object(
                    'customer_name', p_customer_name,
                    'order_id', v_order_id,
                    'total_amount', v_total_amount,
                    'fulfillment_type', p_fulfillment_type
                ),
                'queued',
                'high',
                v_order_id,
                NOW()
            );
        END IF;
        
        -- Build success response
        v_result := jsonb_build_object(
            'success', true,
            'order_id', v_order_id,
            'customer_id', v_customer_id,
            'total_amount', v_total_amount,
            'fulfillment_type', p_fulfillment_type,
            'order_type', v_order_type,
            'message', 'Order created successfully'
        );
        
        RAISE LOG 'Order created successfully: % for customer: %', v_order_id, p_customer_email;
        RETURN v_result;
        
    EXCEPTION 
        WHEN foreign_key_violation THEN
            RAISE LOG 'Foreign key violation in order creation: %', SQLERRM;
            RAISE EXCEPTION 'Order creation failed: Invalid product reference' USING ERRCODE = 'P0001';
        WHEN check_violation THEN
            RAISE LOG 'Check constraint violation in order creation: %', SQLERRM;
            RAISE EXCEPTION 'Order creation failed: Invalid data values' USING ERRCODE = 'P0001';
        WHEN OTHERS THEN
            RAISE LOG 'Order creation failed with error: % (SQLSTATE: %), Customer: %', SQLERRM, SQLSTATE, p_customer_email;
            RAISE EXCEPTION 'Order creation failed: %', SQLERRM USING ERRCODE = 'P0001';
    END;
END;
$$;