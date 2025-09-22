-- ============================================================
-- PHASE 1: Database Schema Alignment
-- Add missing columns to orders table that create_order_with_items expects
-- ============================================================

-- First, let's see what columns currently exist in orders table
-- and add the missing ones that the function is trying to use

-- Add missing columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS fulfillment_type text DEFAULT 'delivery',
ADD COLUMN IF NOT EXISTS promotion_discount numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS promotion_code text,
ADD COLUMN IF NOT EXISTS promotion_id uuid REFERENCES promotions(id);

-- Create index on promotion fields for performance
CREATE INDEX IF NOT EXISTS idx_orders_promotion_code ON orders(promotion_code);
CREATE INDEX IF NOT EXISTS idx_orders_promotion_id ON orders(promotion_id);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_type ON orders(fulfillment_type);

-- ============================================================
-- PHASE 2: Fix create_order_with_items function
-- Drop and recreate with correct column references
-- ============================================================

DROP FUNCTION IF EXISTS create_order_with_items(uuid, text, jsonb, jsonb, uuid, uuid, text, numeric);

CREATE OR REPLACE FUNCTION create_order_with_items(
    p_customer_id uuid,
    p_fulfillment_type text,
    p_items jsonb,
    p_delivery_address jsonb DEFAULT NULL,
    p_pickup_point_id uuid DEFAULT NULL,
    p_delivery_zone_id uuid DEFAULT NULL,
    p_guest_session_id text DEFAULT NULL,
    p_promotion_code text DEFAULT NULL,
    p_client_total numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id uuid;
    v_order_number text;
    v_item record;
    v_subtotal numeric := 0;
    v_promotion_id uuid;
    v_promotion_discount numeric := 0;
    v_customer_info record;
    v_delivery_fee numeric := 0;
    v_total_amount numeric;
BEGIN
    -- Input validation
    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Customer ID is required';
    END IF;
    
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;
    
    IF p_fulfillment_type NOT IN ('delivery', 'pickup') THEN
        RAISE EXCEPTION 'Invalid fulfillment type: %', p_fulfillment_type;
    END IF;

    -- Get customer information
    SELECT name, email, phone INTO v_customer_info
    FROM customer_accounts 
    WHERE id = p_customer_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found: %', p_customer_id;
    END IF;

    -- Validate promotion if provided
    IF p_promotion_code IS NOT NULL THEN
        SELECT id, 
               CASE 
                   WHEN discount_type = 'percentage' THEN 0 -- Calculate later based on subtotal
                   WHEN discount_type = 'fixed_amount' THEN discount_value
                   ELSE 0
               END
        INTO v_promotion_id, v_promotion_discount
        FROM promotions 
        WHERE code = p_promotion_code 
          AND status = 'active'
          AND (start_date IS NULL OR start_date <= CURRENT_DATE)
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
          AND (usage_limit IS NULL OR usage_count < usage_limit);
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid or expired promotion code: %', p_promotion_code;
        END IF;
    END IF;

    -- Generate unique order number
    v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || 
                      LPAD(floor(random() * 10000)::text, 4, '0');

    -- Calculate subtotal from items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Validate required item fields
        IF v_item->>'product_id' IS NULL OR v_item->>'quantity' IS NULL OR v_item->>'unit_price' IS NULL THEN
            RAISE EXCEPTION 'Item missing required fields: product_id, quantity, or unit_price';
        END IF;
        
        -- Add to subtotal
        v_subtotal := v_subtotal + ((v_item->>'quantity')::integer * (v_item->>'unit_price')::numeric);
    END LOOP;

    -- Calculate percentage-based promotion discount
    IF p_promotion_code IS NOT NULL THEN
        SELECT CASE 
                   WHEN discount_type = 'percentage' THEN ROUND(v_subtotal * (discount_value / 100), 2)
                   ELSE v_promotion_discount
               END
        INTO v_promotion_discount
        FROM promotions 
        WHERE id = v_promotion_id;
    END IF;

    -- Get delivery fee if delivery order
    IF p_fulfillment_type = 'delivery' AND p_delivery_zone_id IS NOT NULL THEN
        SELECT COALESCE(base_fee, 0) INTO v_delivery_fee
        FROM delivery_zones 
        WHERE id = p_delivery_zone_id AND is_active = true;
    END IF;

    -- Calculate total amount
    v_total_amount := v_subtotal + v_delivery_fee - COALESCE(v_promotion_discount, 0);
    
    -- Ensure total is not negative
    IF v_total_amount < 0 THEN
        v_total_amount := 0;
    END IF;

    -- Create the order with all required fields
    INSERT INTO orders (
        order_number,
        customer_id,
        customer_name,
        customer_email,
        customer_phone,
        fulfillment_type,
        delivery_address,
        pickup_point_id,
        delivery_zone_id,
        subtotal_amount,
        delivery_fee,
        promotion_id,
        promotion_code,
        promotion_discount,
        total_amount,
        status,
        payment_status,
        created_at,
        updated_at
    ) VALUES (
        v_order_number,
        p_customer_id,
        v_customer_info.name,
        v_customer_info.email,
        v_customer_info.phone,
        p_fulfillment_type,
        p_delivery_address,
        p_pickup_point_id,
        p_delivery_zone_id,
        v_subtotal,
        v_delivery_fee,
        v_promotion_id,
        p_promotion_code,
        v_promotion_discount,
        v_total_amount,
        'pending'::order_status,
        'pending'::payment_status,
        NOW(),
        NOW()
    ) RETURNING id INTO v_order_id;

    -- Insert order items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO order_items (
            order_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total_price,
            customizations,
            created_at
        ) VALUES (
            v_order_id,
            (v_item->>'product_id')::uuid,
            v_item->>'product_name',
            (v_item->>'quantity')::integer,
            (v_item->>'unit_price')::numeric,
            (v_item->>'quantity')::integer * (v_item->>'unit_price')::numeric,
            v_item->'customizations', -- FIXED: Use -> for JSONB, not ->>
            NOW()
        );
    END LOOP;

    -- Update promotion usage count if promotion was used
    IF v_promotion_id IS NOT NULL THEN
        UPDATE promotions 
        SET usage_count = usage_count + 1,
            updated_at = NOW()
        WHERE id = v_promotion_id;
    END IF;

    -- Log the order creation
    INSERT INTO audit_logs (
        action, 
        category, 
        message, 
        entity_id, 
        new_values
    ) VALUES (
        'order_created',
        'Order Management',
        'Order created successfully via create_order_with_items',
        v_order_id,
        jsonb_build_object(
            'order_number', v_order_number,
            'customer_id', p_customer_id,
            'fulfillment_type', p_fulfillment_type,
            'total_amount', v_total_amount,
            'promotion_code', p_promotion_code
        )
    );

    RETURN v_order_id;

EXCEPTION WHEN OTHERS THEN
    -- Log the error
    INSERT INTO audit_logs (
        action, 
        category, 
        message, 
        new_values
    ) VALUES (
        'order_creation_failed',
        'Order Management Error',
        'Order creation failed: ' || SQLERRM,
        jsonb_build_object(
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'customer_id', p_customer_id,
            'fulfillment_type', p_fulfillment_type
        )
    );
    
    -- Re-raise the exception
    RAISE;
END;
$$;