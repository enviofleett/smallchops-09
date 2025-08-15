-- PHASE 1: Fix Critical Access Issues

-- 1. Fix verify_and_update_payment_status function column ambiguity
CREATE OR REPLACE FUNCTION public.verify_and_update_payment_status(
    payment_ref text, 
    new_status text, 
    payment_amount numeric DEFAULT NULL::numeric, 
    payment_gateway_response jsonb DEFAULT NULL::jsonb
)
RETURNS TABLE(
    order_id uuid, 
    order_number text, 
    status text, 
    amount numeric, 
    customer_email text, 
    order_type text, 
    payment_reference text, 
    updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    order_record RECORD;
    normalized_ref TEXT;
    v_user_context jsonb;
    v_security_check boolean := false;
    v_order_updated_at timestamp with time zone;
BEGIN
    -- Comprehensive input validation
    IF payment_ref IS NULL OR LENGTH(TRIM(payment_ref)) = 0 THEN
        RAISE EXCEPTION 'Payment reference cannot be null or empty';
    END IF;
    
    IF new_status IS NULL OR LENGTH(TRIM(new_status)) = 0 THEN
        RAISE EXCEPTION 'Payment status cannot be null or empty';
    END IF;
    
    IF new_status NOT IN ('pending', 'confirmed', 'failed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid payment status: %', new_status;
    END IF;

    -- Capture user context for security logging
    v_user_context := jsonb_build_object(
        'user_id', auth.uid(),
        'user_role', auth.role(),
        'timestamp', NOW(),
        'payment_ref', payment_ref,
        'new_status', new_status,
        'amount_provided', payment_amount IS NOT NULL
    );

    -- Enhanced security check - only service roles or admins can verify payments
    IF auth.role() = 'service_role' OR is_admin() THEN
        v_security_check := true;
    ELSE
        INSERT INTO security_incidents (
            type, description, severity, user_id, reference, created_at
        ) VALUES (
            'unauthorized_payment_verification',
            'Unauthorized user attempted payment verification',
            'critical',
            auth.uid(),
            payment_ref,
            NOW()
        );
        
        RAISE EXCEPTION 'Unauthorized: Only service roles can verify payments';
    END IF;

    -- Normalize the payment reference
    normalized_ref := TRIM(payment_ref);
    
    -- Log payment verification attempt
    INSERT INTO payment_processing_logs (
        payment_reference, reference_type, processing_stage, metadata
    ) VALUES (
        payment_ref,
        CASE 
            WHEN payment_ref LIKE 'txn_%' THEN 'transaction'
            WHEN payment_ref LIKE 'pay_%' THEN 'payment'
            ELSE 'unknown'
        END,
        'payment_verification_attempt_secure',
        v_user_context
    );

    -- Find order with enhanced reference matching using explicit table alias
    SELECT o.id, o.order_number, o.status, o.total_amount, o.customer_email, 
           o.order_type, o.payment_reference, o.updated_at
    INTO order_record
    FROM orders o
    WHERE o.payment_reference = normalized_ref;

    -- Try alternative reference formats if not found
    IF order_record.id IS NULL AND payment_ref LIKE 'pay_%' THEN
        normalized_ref := 'txn_' || substring(payment_ref from 5);
        
        SELECT o.id, o.order_number, o.status, o.total_amount, o.customer_email, 
               o.order_type, o.payment_reference, o.updated_at
        INTO order_record
        FROM orders o
        WHERE o.payment_reference = normalized_ref;
    END IF;

    IF order_record.id IS NULL AND payment_ref LIKE 'txn_%' THEN
        normalized_ref := 'pay_' || substring(payment_ref from 5);
        
        SELECT o.id, o.order_number, o.status, o.total_amount, o.customer_email, 
               o.order_type, o.payment_reference, o.updated_at
        INTO order_record
        FROM orders o
        WHERE o.payment_reference = normalized_ref;
    END IF;

    -- Enhanced error handling for missing orders
    IF order_record.id IS NULL THEN
        INSERT INTO security_incidents (
            type, description, severity, reference, user_id, created_at
        ) VALUES (
            'payment_verification_orphaned',
            'Payment verification attempted for non-existent order reference',
            'medium',
            payment_ref,
            auth.uid(),
            NOW()
        );
        
        RAISE EXCEPTION 'No order found for payment reference: %', payment_ref;
    END IF;

    -- Skip verification if order is already confirmed
    IF order_record.status = 'confirmed' THEN
        INSERT INTO payment_processing_logs (
            order_id, payment_reference, processing_stage, metadata
        ) VALUES (
            order_record.id,
            payment_ref,
            'payment_verification_skipped_confirmed',
            v_user_context || jsonb_build_object('reason', 'Order already confirmed')
        );
        
        -- Return existing order details
        RETURN QUERY SELECT 
            order_record.id,
            order_record.order_number,
            order_record.status,
            order_record.total_amount,
            order_record.customer_email,
            order_record.order_type::TEXT,
            order_record.payment_reference,
            order_record.updated_at;
        RETURN;
    END IF;

    -- Enhanced amount validation with tolerance for rounding
    IF payment_amount IS NOT NULL AND ABS(payment_amount - order_record.total_amount) > 0.01 THEN
        INSERT INTO security_incidents (
            type, description, severity, reference, expected_amount, received_amount, user_id, created_at
        ) VALUES (
            'payment_amount_mismatch_critical',
            'Critical payment amount verification failed - potential fraud',
            'critical',
            payment_ref,
            order_record.total_amount,
            payment_amount,
            auth.uid(),
            NOW()
        );
        
        RAISE EXCEPTION 'Payment amount mismatch. Expected: %, Received: %', order_record.total_amount, payment_amount;
    END IF;

    -- Store current timestamp to avoid ambiguity (FIX: Use explicit variable)
    v_order_updated_at := NOW();

    -- Update the order status with enhanced logging and explicit column handling
    UPDATE orders 
    SET 
        status = new_status::order_status,
        updated_at = v_order_updated_at,
        paid_at = CASE WHEN new_status = 'confirmed' THEN v_order_updated_at ELSE paid_at END
    WHERE id = order_record.id;

    -- Log successful verification
    INSERT INTO payment_processing_logs (
        order_id, payment_reference, processing_stage, metadata
    ) VALUES (
        order_record.id,
        payment_ref,
        'payment_verification_success_secure',
        v_user_context || jsonb_build_object(
            'order_updated', true,
            'previous_status', order_record.status,
            'new_status', new_status,
            'amount_verified', payment_amount IS NOT NULL
        )
    );

    -- Enhanced audit trail
    INSERT INTO audit_logs (
        action, category, message, user_id, entity_id, old_values, new_values
    ) VALUES (
        'payment_verified_secure',
        'Payment Security',
        'Payment verification completed securely for order: ' || order_record.order_number,
        auth.uid(),
        order_record.id,
        jsonb_build_object('old_status', order_record.status),
        jsonb_build_object(
            'new_status', new_status,
            'payment_reference', payment_ref,
            'amount_verified', payment_amount,
            'gateway_response_received', payment_gateway_response IS NOT NULL
        )
    );

    -- Return results (FIX: Use explicit variable for updated_at)
    RETURN QUERY SELECT 
        order_record.id,
        order_record.order_number,
        new_status,
        order_record.total_amount,
        order_record.customer_email,
        order_record.order_type::TEXT,
        order_record.payment_reference,
        v_order_updated_at;

EXCEPTION 
    WHEN OTHERS THEN
        -- Enhanced error logging
        INSERT INTO payment_processing_logs (
            payment_reference, processing_stage, error_message, metadata
        ) VALUES (
            payment_ref,
            'payment_verification_error_secure',
            SQLERRM,
            v_user_context || jsonb_build_object(
                'error_code', SQLSTATE,
                'function', 'verify_and_update_payment_status_secure'
            )
        );
        RAISE;
END;
$function$;

-- 2. Create public-accessible orders_with_payment view
CREATE OR REPLACE VIEW public.orders_with_payment AS
SELECT 
    o.id,
    o.order_number,
    o.customer_id,
    o.customer_name,
    o.customer_email,
    o.customer_phone,
    o.order_type,
    o.delivery_address,
    o.pickup_point_id,
    o.delivery_zone_id,
    o.total_amount,
    o.payment_method,
    o.payment_status,
    o.status,
    o.payment_reference,
    o.paystack_reference,
    o.paid_at,
    o.order_time,
    o.created_at,
    o.updated_at,
    -- Computed payment status for better UX
    CASE 
        WHEN o.payment_status = 'paid' THEN 'paid'
        WHEN o.payment_status = 'pending' AND o.status = 'confirmed' THEN 'processing'
        WHEN o.payment_status = 'pending' THEN 'pending'
        WHEN o.payment_status = 'failed' THEN 'failed'
        ELSE 'unknown'
    END as computed_payment_status,
    -- Payment transaction details if available
    pt.provider_reference,
    pt.amount as transaction_amount,
    pt.currency,
    pt.status as transaction_status,
    pt.gateway_response,
    pt.created_at as transaction_created_at
FROM orders o
LEFT JOIN payment_transactions pt ON o.payment_reference = pt.provider_reference
    OR o.paystack_reference = pt.provider_reference;

-- Grant access to the view
GRANT SELECT ON public.orders_with_payment TO authenticated;
GRANT SELECT ON public.orders_with_payment TO anon;

-- 3. Fix get_order_payment_status function with proper permissions and error handling
CREATE OR REPLACE FUNCTION public.get_order_payment_status(p_order_id uuid)
RETURNS TABLE(
    order_id uuid, 
    order_number text, 
    payment_status text, 
    payment_reference text, 
    total_amount numeric, 
    computed_payment_status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    -- Return data if user has permission to see this order
    SELECT 
        v.id,
        v.order_number,
        v.payment_status,
        v.payment_reference,
        v.total_amount,
        v.computed_payment_status
    FROM public.orders_with_payment v
    WHERE v.id = p_order_id
    AND (
        -- Admin check
        (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true))
        OR 
        -- Customer owns this order
        (v.customer_id IN (
            SELECT ca.id FROM customer_accounts ca WHERE ca.user_id = auth.uid()
        ))
        OR
        -- Guest order email match
        (v.customer_email IS NOT NULL AND v.customer_email IN (
            SELECT u.email FROM auth.users u WHERE u.id = auth.uid()
        ))
        OR
        -- Allow service role access
        (auth.role() = 'service_role')
    );
$function$;

-- Grant execute permissions to the function
GRANT EXECUTE ON FUNCTION public.get_order_payment_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_payment_status(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_payment_status(uuid) TO service_role;