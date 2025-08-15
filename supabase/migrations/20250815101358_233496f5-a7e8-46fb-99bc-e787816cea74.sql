-- Fix ambiguous column reference in verify_and_update_payment_status and consolidate payment verification
CREATE OR REPLACE FUNCTION public.verify_and_update_payment_status(
    p_order_id text,
    p_reference text,
    p_provider_ref text,
    p_provider text,
    p_new_state text,
    p_amount numeric,
    p_currency text,
    p_raw jsonb
) RETURNS TABLE(
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
    v_order_record RECORD;
    v_normalized_ref TEXT;
    v_user_context jsonb;
    v_final_updated_at timestamp with time zone;
    v_processing_stage text := 'initialization';
BEGIN
    v_processing_stage := 'input_validation';
    
    -- Comprehensive input validation
    IF p_order_id IS NULL OR LENGTH(TRIM(p_order_id)) = 0 THEN
        RAISE EXCEPTION 'Order ID cannot be null or empty';
    END IF;
    
    IF p_reference IS NULL OR LENGTH(TRIM(p_reference)) = 0 THEN
        RAISE EXCEPTION 'Payment reference cannot be null or empty';
    END IF;
    
    IF p_new_state IS NULL OR LENGTH(TRIM(p_new_state)) = 0 THEN
        RAISE EXCEPTION 'Payment state cannot be null or empty';
    END IF;
    
    IF p_new_state NOT IN ('paid', 'failed', 'abandoned', 'refunded') THEN
        RAISE EXCEPTION 'Invalid payment state: %', p_new_state;
    END IF;

    v_processing_stage := 'security_validation';
    
    -- Capture user context for security logging
    v_user_context := jsonb_build_object(
        'user_id', auth.uid(),
        'user_role', auth.role(),
        'timestamp', NOW(),
        'order_id', p_order_id,
        'reference', p_reference,
        'new_state', p_new_state,
        'amount_provided', p_amount IS NOT NULL
    );

    -- Enhanced security check - only service roles can verify payments
    IF auth.role() != 'service_role' THEN
        INSERT INTO security_incidents (
            type, description, severity, user_id, reference, created_at
        ) VALUES (
            'unauthorized_payment_verification',
            'Unauthorized payment verification attempt',
            'critical',
            auth.uid(),
            p_reference,
            NOW()
        );
        
        RAISE EXCEPTION 'Unauthorized: Only service roles can verify payments';
    END IF;

    v_processing_stage := 'reference_normalization';
    
    -- Normalize the payment reference to txn_ format if needed
    v_normalized_ref := TRIM(p_reference);
    IF v_normalized_ref LIKE 'pay_%' THEN
        v_normalized_ref := 'txn_' || substring(v_normalized_ref from 5);
    END IF;
    
    -- Log payment verification attempt
    INSERT INTO payment_processing_logs (
        order_id, payment_reference, reference_type, processing_stage, metadata
    ) VALUES (
        p_order_id::uuid,
        p_reference,
        CASE 
            WHEN p_reference LIKE 'txn_%' THEN 'transaction'
            WHEN p_reference LIKE 'pay_%' THEN 'payment'
            ELSE 'unknown'
        END,
        'unified_verification_attempt',
        v_user_context
    );

    v_processing_stage := 'order_lookup';
    
    -- Find order with enhanced reference matching - use explicit table alias to avoid ambiguity
    SELECT o.id, o.order_number, o.status, o.total_amount, o.customer_email, 
           o.order_type, o.payment_reference, o.updated_at
    INTO v_order_record
    FROM orders o
    WHERE o.id = p_order_id::uuid 
       OR o.payment_reference = v_normalized_ref 
       OR o.payment_reference = p_reference;

    -- Enhanced error handling for missing orders
    IF v_order_record.id IS NULL THEN
        INSERT INTO security_incidents (
            type, description, severity, reference, user_id, created_at
        ) VALUES (
            'payment_verification_orphaned',
            'Payment verification attempted for non-existent order',
            'medium',
            p_reference,
            auth.uid(),
            NOW()
        );
        
        RAISE EXCEPTION 'No order found for payment reference: %', p_reference;
    END IF;

    v_processing_stage := 'status_check';
    
    -- Skip verification if order is already paid
    IF v_order_record.status = 'confirmed' THEN
        INSERT INTO payment_processing_logs (
            order_id, payment_reference, processing_stage, metadata
        ) VALUES (
            v_order_record.id,
            p_reference,
            'verification_skipped_confirmed',
            v_user_context || jsonb_build_object('reason', 'Order already confirmed')
        );
        
        -- Return existing order details without changes
        RETURN QUERY SELECT 
            v_order_record.id,
            v_order_record.order_number,
            v_order_record.status,
            v_order_record.total_amount,
            v_order_record.customer_email,
            v_order_record.order_type::TEXT,
            v_order_record.payment_reference,
            v_order_record.updated_at;
        RETURN;
    END IF;

    v_processing_stage := 'amount_validation';
    
    -- Enhanced amount validation with tolerance for rounding
    IF p_amount IS NOT NULL AND ABS(p_amount - v_order_record.total_amount) > 0.01 THEN
        INSERT INTO security_incidents (
            type, description, severity, reference, expected_amount, received_amount, user_id, created_at
        ) VALUES (
            'payment_amount_mismatch_critical',
            'Critical payment amount verification failed',
            'critical',
            p_reference,
            v_order_record.total_amount,
            p_amount,
            auth.uid(),
            NOW()
        );
        
        RAISE EXCEPTION 'Payment amount mismatch. Expected: %, Received: %', v_order_record.total_amount, p_amount;
    END IF;

    v_processing_stage := 'payment_transaction_update';
    
    -- Create or update payment transaction record
    INSERT INTO payment_transactions (
        order_id, provider_reference, amount, currency, status, 
        provider_response, paid_at, processed_at, created_at
    ) VALUES (
        v_order_record.id, p_provider_ref, p_amount, p_currency, 
        CASE WHEN p_new_state = 'paid' THEN 'paid' ELSE 'failed' END,
        p_raw, 
        CASE WHEN p_new_state = 'paid' THEN NOW() ELSE NULL END,
        NOW(), NOW()
    )
    ON CONFLICT (provider_reference) 
    DO UPDATE SET 
        status = CASE WHEN p_new_state = 'paid' THEN 'paid' ELSE 'failed' END,
        amount = p_amount,
        processed_at = NOW(),
        provider_response = p_raw;

    v_processing_stage := 'order_status_update';
    
    -- Store timestamp to avoid ambiguity - FIX for the ambiguous column error
    v_final_updated_at := NOW();

    -- Update the order status with enhanced logging - use explicit column references
    UPDATE orders 
    SET 
        status = CASE WHEN p_new_state = 'paid' THEN 'confirmed'::order_status ELSE 'failed'::order_status END,
        payment_status = p_new_state::payment_status,
        updated_at = v_final_updated_at,
        paid_at = CASE WHEN p_new_state = 'paid' THEN v_final_updated_at ELSE paid_at END
    WHERE id = v_order_record.id;

    v_processing_stage := 'audit_logging';
    
    -- Log successful verification
    INSERT INTO payment_processing_logs (
        order_id, payment_reference, processing_stage, metadata
    ) VALUES (
        v_order_record.id,
        p_reference,
        'unified_verification_success',
        v_user_context || jsonb_build_object(
            'order_updated', true,
            'previous_status', v_order_record.status,
            'new_status', CASE WHEN p_new_state = 'paid' THEN 'confirmed' ELSE 'failed' END,
            'amount_verified', p_amount IS NOT NULL,
            'provider', p_provider
        )
    );

    -- Enhanced audit trail
    INSERT INTO audit_logs (
        action, category, message, user_id, entity_id, old_values, new_values
    ) VALUES (
        'payment_verified_unified',
        'Payment Verification',
        'Payment verification completed via unified function for order: ' || v_order_record.order_number,
        auth.uid(),
        v_order_record.id,
        jsonb_build_object('old_status', v_order_record.status),
        jsonb_build_object(
            'new_status', CASE WHEN p_new_state = 'paid' THEN 'confirmed' ELSE 'failed' END,
            'payment_reference', p_reference,
            'amount_verified', p_amount,
            'provider', p_provider
        )
    );

    -- Return results with explicit column selection to avoid ambiguity
    RETURN QUERY SELECT 
        v_order_record.id,
        v_order_record.order_number,
        CASE WHEN p_new_state = 'paid' THEN 'confirmed' ELSE 'failed' END,
        v_order_record.total_amount,
        v_order_record.customer_email,
        v_order_record.order_type::TEXT,
        v_order_record.payment_reference,
        v_final_updated_at;

EXCEPTION 
    WHEN OTHERS THEN
        -- Enhanced error logging with processing stage context
        INSERT INTO payment_processing_logs (
            order_id, payment_reference, processing_stage, error_message, metadata
        ) VALUES (
            COALESCE(v_order_record.id, p_order_id::uuid),
            p_reference,
            'unified_verification_error_' || v_processing_stage,
            SQLERRM,
            v_user_context || jsonb_build_object(
                'error_code', SQLSTATE,
                'function', 'verify_and_update_payment_status_unified',
                'processing_stage', v_processing_stage
            )
        );
        RAISE;
END;
$function$;