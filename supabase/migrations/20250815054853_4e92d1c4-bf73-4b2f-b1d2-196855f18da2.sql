-- STEP 1: Emergency Constraint Relaxation
-- Run this FIRST to prevent immediate checkout failures

-- Temporarily allow both txn_ and pay_ prefixes during the fix
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_no_pay_prefix;

-- Add a more flexible constraint during transition
ALTER TABLE orders ADD CONSTRAINT chk_orders_valid_payment_reference 
CHECK (
    payment_reference IS NULL OR 
    payment_reference LIKE 'txn_%' OR 
    payment_reference LIKE 'pay_%'
);

-- STEP 2: Add logging table for payment tracking
CREATE TABLE IF NOT EXISTS payment_processing_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id),
    payment_reference TEXT,
    reference_type TEXT,
    fulfillment_type TEXT,
    processing_stage TEXT,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant permissions
GRANT ALL ON payment_processing_logs TO service_role;
GRANT SELECT, INSERT ON payment_processing_logs TO authenticated;

-- STEP 3: Create improved order update function with better error handling
CREATE OR REPLACE FUNCTION update_order_with_payment_reference(
    order_uuid UUID,
    new_payment_reference TEXT,
    order_fulfillment_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result_data JSONB;
    order_exists BOOLEAN DEFAULT FALSE;
    current_reference TEXT;
    reference_prefix TEXT;
BEGIN
    -- Log the attempt
    INSERT INTO payment_processing_logs (
        order_id, 
        payment_reference, 
        reference_type,
        fulfillment_type,
        processing_stage,
        metadata
    ) VALUES (
        order_uuid,
        new_payment_reference,
        CASE 
            WHEN new_payment_reference LIKE 'txn_%' THEN 'transaction'
            WHEN new_payment_reference LIKE 'pay_%' THEN 'payment'
            ELSE 'unknown'
        END,
        order_fulfillment_type,
        'reference_update_attempt',
        jsonb_build_object('function_called', 'update_order_with_payment_reference')
    );

    -- Validate reference format - ensure it's txn_ format
    IF new_payment_reference NOT LIKE 'txn_%' THEN
        -- Convert pay_ to txn_ format if needed
        IF new_payment_reference LIKE 'pay_%' THEN
            new_payment_reference := 'txn_' || substring(new_payment_reference from 5);
            
            INSERT INTO payment_processing_logs (
                order_id, 
                payment_reference,
                reference_type,
                processing_stage,
                metadata
            ) VALUES (
                order_uuid,
                new_payment_reference,
                'transaction_converted',
                'reference_format_conversion',
                jsonb_build_object('original_format', 'pay_', 'converted_format', 'txn_')
            );
        ELSE
            RAISE EXCEPTION 'Invalid payment reference format. Expected txn_ or pay_ prefix, got: %', new_payment_reference;
        END IF;
    END IF;

    -- Check if order exists and get current payment reference
    SELECT payment_reference INTO current_reference 
    FROM orders 
    WHERE id = order_uuid;
    
    IF NOT FOUND THEN
        INSERT INTO payment_processing_logs (
            order_id, 
            payment_reference,
            processing_stage,
            error_message
        ) VALUES (
            order_uuid,
            new_payment_reference,
            'reference_update_failed',
            'Order not found'
        );
        RAISE EXCEPTION 'Order not found: %', order_uuid;
    END IF;

    -- Check if order already has a payment reference
    IF current_reference IS NOT NULL AND current_reference != new_payment_reference THEN
        INSERT INTO payment_processing_logs (
            order_id, 
            payment_reference,
            processing_stage,
            error_message,
            metadata
        ) VALUES (
            order_uuid,
            new_payment_reference,
            'reference_update_skipped',
            'Order already has different payment reference',
            jsonb_build_object('existing_reference', current_reference)
        );
        
        -- Return existing reference instead of failing
        SELECT jsonb_build_object(
            'success', true,
            'order_id', id,
            'payment_reference', payment_reference,
            'status', status,
            'message', 'Order already has payment reference'
        ) INTO result_data
        FROM orders
        WHERE id = order_uuid;
        
        RETURN result_data;
    END IF;

    -- Update the order
    UPDATE orders 
    SET 
        payment_reference = new_payment_reference,
        updated_at = NOW()
    WHERE id = order_uuid
    RETURNING jsonb_build_object(
        'success', true,
        'order_id', id,
        'payment_reference', payment_reference,
        'status', status,
        'fulfillment_type', fulfillment_type,
        'message', 'Payment reference updated successfully'
    ) INTO result_data;

    -- Log successful update
    INSERT INTO payment_processing_logs (
        order_id, 
        payment_reference,
        processing_stage,
        metadata
    ) VALUES (
        order_uuid,
        new_payment_reference,
        'reference_update_success',
        jsonb_build_object('updated_at', NOW())
    );

    RETURN result_data;
    
EXCEPTION 
    WHEN OTHERS THEN
        -- Log the error
        INSERT INTO payment_processing_logs (
            order_id, 
            payment_reference,
            processing_stage,
            error_message,
            metadata
        ) VALUES (
            order_uuid,
            new_payment_reference,
            'reference_update_error',
            SQLERRM,
            jsonb_build_object('error_code', SQLSTATE)
        );
        
        -- Re-raise the exception
        RAISE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION update_order_with_payment_reference TO service_role;

-- STEP 4: Enhanced payment verification function
CREATE OR REPLACE FUNCTION verify_and_update_payment_status(
    payment_ref TEXT,
    new_status TEXT,
    payment_amount DECIMAL DEFAULT NULL,
    payment_gateway_response JSONB DEFAULT NULL
)
RETURNS TABLE(
    order_id UUID,
    order_number TEXT,
    status TEXT,
    amount DECIMAL,
    customer_email TEXT,
    fulfillment_type TEXT,
    payment_reference TEXT,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    order_record RECORD;
    normalized_ref TEXT;
BEGIN
    -- Normalize the payment reference - handle both txn_ and pay_ formats
    normalized_ref := payment_ref;
    
    -- Log payment verification attempt
    INSERT INTO payment_processing_logs (
        payment_reference,
        reference_type,
        processing_stage,
        metadata
    ) VALUES (
        payment_ref,
        CASE 
            WHEN payment_ref LIKE 'txn_%' THEN 'transaction'
            WHEN payment_ref LIKE 'pay_%' THEN 'payment'
            ELSE 'unknown'
        END,
        'payment_verification_attempt',
        jsonb_build_object(
            'new_status', new_status,
            'payment_amount', payment_amount
        )
    );

    -- Try to find order with exact reference first
    SELECT o.id, o.order_number, o.status, o.amount, o.customer_email, 
           o.fulfillment_type, o.payment_reference, o.updated_at
    INTO order_record
    FROM orders o
    WHERE o.payment_reference = normalized_ref;

    -- If not found and reference has pay_ prefix, try converting to txn_
    IF order_record.id IS NULL AND payment_ref LIKE 'pay_%' THEN
        normalized_ref := 'txn_' || substring(payment_ref from 5);
        
        SELECT o.id, o.order_number, o.status, o.amount, o.customer_email, 
               o.fulfillment_type, o.payment_reference, o.updated_at
        INTO order_record
        FROM orders o
        WHERE o.payment_reference = normalized_ref;
        
        INSERT INTO payment_processing_logs (
            payment_reference,
            processing_stage,
            metadata
        ) VALUES (
            payment_ref,
            'reference_normalization',
            jsonb_build_object('normalized_to', normalized_ref)
        );
    END IF;

    -- If still not found, try the reverse (txn_ to pay_)
    IF order_record.id IS NULL AND payment_ref LIKE 'txn_%' THEN
        normalized_ref := 'pay_' || substring(payment_ref from 5);
        
        SELECT o.id, o.order_number, o.status, o.amount, o.customer_email, 
               o.fulfillment_type, o.payment_reference, o.updated_at
        INTO order_record
        FROM orders o
        WHERE o.payment_reference = normalized_ref;
    END IF;

    IF order_record.id IS NULL THEN
        INSERT INTO payment_processing_logs (
            payment_reference,
            processing_stage,
            error_message
        ) VALUES (
            payment_ref,
            'payment_verification_failed',
            'No order found for payment reference'
        );
        RAISE EXCEPTION 'No order found for payment reference: %', payment_ref;
    END IF;

    -- Check if order is already confirmed
    IF order_record.status = 'confirmed' THEN
        INSERT INTO payment_processing_logs (
            order_id,
            payment_reference,
            processing_stage,
            metadata
        ) VALUES (
            order_record.id,
            payment_ref,
            'payment_verification_skipped',
            jsonb_build_object('reason', 'Order already confirmed')
        );
        
        -- Return existing order details
        RETURN QUERY SELECT 
            order_record.id,
            order_record.order_number,
            order_record.status,
            order_record.amount,
            order_record.customer_email,
            order_record.fulfillment_type,
            order_record.payment_reference,
            order_record.updated_at;
        RETURN;
    END IF;

    -- Update the order status
    UPDATE orders
    SET 
        status = new_status,
        updated_at = NOW(),
        payment_verified_at = NOW(),
        payment_amount = COALESCE(verify_and_update_payment_status.payment_amount, orders.amount),
        payment_gateway_response = COALESCE(verify_and_update_payment_status.payment_gateway_response, orders.payment_gateway_response)
    WHERE id = order_record.id
    RETURNING 
        id, order_number, status, amount, customer_email, fulfillment_type, payment_reference, updated_at
    INTO order_record;

    -- Log successful update
    INSERT INTO payment_processing_logs (
        order_id,
        payment_reference,
        processing_stage,
        metadata
    ) VALUES (
        order_record.id,
        payment_ref,
        'payment_verification_success',
        jsonb_build_object(
            'new_status', new_status,
            'fulfillment_type', order_record.fulfillment_type
        )
    );

    RETURN QUERY SELECT 
        order_record.id,
        order_record.order_number,
        order_record.status,
        order_record.amount,
        order_record.customer_email,
        order_record.fulfillment_type,
        order_record.payment_reference,
        order_record.updated_at;

EXCEPTION 
    WHEN OTHERS THEN
        INSERT INTO payment_processing_logs (
            payment_reference,
            processing_stage,
            error_message,
            metadata
        ) VALUES (
            payment_ref,
            'payment_verification_error',
            SQLERRM,
            jsonb_build_object('error_code', SQLSTATE)
        );
        RAISE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION verify_and_update_payment_status TO service_role;

-- STEP 5: Create monitoring view for payment issues
CREATE OR REPLACE VIEW payment_processing_status AS
SELECT 
    ppl.created_at,
    ppl.order_id,
    o.order_number,
    o.fulfillment_type,
    ppl.payment_reference,
    ppl.reference_type,
    ppl.processing_stage,
    ppl.error_message,
    o.status as current_order_status,
    CASE 
        WHEN o.status = 'confirmed' THEN 'SUCCESS'
        WHEN ppl.error_message IS NOT NULL THEN 'ERROR'
        ELSE 'PROCESSING'
    END as overall_status
FROM payment_processing_logs ppl
LEFT JOIN orders o ON ppl.order_id = o.id
WHERE ppl.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY ppl.created_at DESC;

-- Grant read access to monitoring view
GRANT SELECT ON payment_processing_status TO service_role;
GRANT SELECT ON payment_processing_status TO authenticated;