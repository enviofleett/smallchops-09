-- Phase 1: Clean Database Schema with Sample Data
-- Drop existing conflicting functions first
DROP FUNCTION IF EXISTS public.create_order_with_items(text, text, jsonb);
DROP FUNCTION IF EXISTS public.create_order_with_items(text, text, text, text, text, jsonb, numeric, numeric, numeric, numeric);

-- Add sample products if not exists
INSERT INTO public.products (id, name, price, category_id, status, image_url, description, created_at, updated_at) 
VALUES 
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Chicken Wings', 1500.00, (SELECT id FROM categories LIMIT 1), 'active', NULL, 'Delicious chicken wings', NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Beef Samosa', 800.00, (SELECT id FROM categories LIMIT 1), 'active', NULL, 'Crispy beef samosa', NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Fish Roll', 1200.00, (SELECT id FROM categories LIMIT 1), 'active', NULL, 'Fresh fish roll', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Phase 2: Create Single, Bulletproof Database Function
CREATE OR REPLACE FUNCTION public.create_order_with_items(
    p_customer_email text,
    p_customer_name text,
    p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_order_id uuid;
    v_item jsonb;
    v_product_record RECORD;
    v_subtotal numeric := 0;
    v_item_count integer := 0;
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

    -- Start transaction
    BEGIN
        -- Calculate subtotal by iterating through items
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            -- Validate item structure
            IF NOT (v_item ? 'product_id' AND v_item ? 'quantity') THEN
                RAISE EXCEPTION 'Each item must have product_id and quantity';
            END IF;
            
            -- Get product details and validate existence
            SELECT id, name, price INTO v_product_record
            FROM public.products 
            WHERE id = (v_item->>'product_id')::uuid 
            AND status = 'active';
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Product with ID % not found or not active', v_item->>'product_id';
            END IF;
            
            -- Add to subtotal
            v_subtotal := v_subtotal + (v_product_record.price * (v_item->>'quantity')::integer);
            v_item_count := v_item_count + 1;
        END LOOP;
        
        -- Ensure subtotal is never null
        IF v_subtotal IS NULL THEN
            v_subtotal := 0;
        END IF;
        
        -- Create the order
        INSERT INTO public.orders (
            customer_email,
            customer_name,
            subtotal,
            total_amount,
            status,
            payment_status
        ) VALUES (
            p_customer_email,
            p_customer_name,
            v_subtotal,
            v_subtotal, -- For now, total equals subtotal
            'pending',
            'pending'
        ) RETURNING id INTO v_order_id;
        
        -- Insert order items
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            -- Get product price again for order_items
            SELECT price INTO v_product_record.price
            FROM public.products 
            WHERE id = (v_item->>'product_id')::uuid;
            
            INSERT INTO public.order_items (
                order_id,
                product_id,
                quantity,
                unit_price,
                subtotal
            ) VALUES (
                v_order_id,
                (v_item->>'product_id')::uuid,
                (v_item->>'quantity')::integer,
                v_product_record.price,
                v_product_record.price * (v_item->>'quantity')::integer
            );
        END LOOP;
        
        -- Log successful order creation
        INSERT INTO public.audit_logs (action, category, message, new_values)
        VALUES (
            'order_created',
            'Order Management',
            'New order created successfully',
            jsonb_build_object(
                'order_id', v_order_id,
                'customer_email', p_customer_email,
                'subtotal', v_subtotal,
                'item_count', v_item_count
            )
        );
        
        -- Return success response
        RETURN jsonb_build_object(
            'success', true,
            'order_id', v_order_id,
            'subtotal', v_subtotal,
            'message', 'Order created successfully'
        );
        
    EXCEPTION
        WHEN OTHERS THEN
            -- Log the error
            INSERT INTO public.audit_logs (action, category, message, new_values)
            VALUES (
                'order_creation_failed',
                'Order Management',
                'Order creation failed: ' || SQLERRM,
                jsonb_build_object(
                    'customer_email', p_customer_email,
                    'error', SQLERRM,
                    'error_state', SQLSTATE
                )
            );
            
            -- Re-raise the exception
            RAISE;
    END;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.create_order_with_items(text, text, jsonb) TO service_role;