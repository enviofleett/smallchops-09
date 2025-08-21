-- ========================================
-- 🚨 COMPREHENSIVE PRODUCTION PAYMENT FIX
-- Fixes all critical payment system issues
-- ========================================

-- PART 1: Ensure RPC Function Exists and Works Correctly
-- =====================================================

CREATE OR REPLACE FUNCTION public.verify_and_update_payment_status(
  payment_ref TEXT,
  new_status TEXT DEFAULT 'confirmed',
  payment_amount NUMERIC DEFAULT NULL,
  payment_gateway_response JSONB DEFAULT NULL
)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  status TEXT,
  amount NUMERIC,
  customer_email TEXT,
  order_type TEXT,
  payment_reference TEXT,
  updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_order_record RECORD;
  v_updated_order RECORD;
BEGIN
  -- Log the verification attempt
  RAISE NOTICE '[VERIFY_PAYMENT_RPC] Processing payment verification: ref=%, status=%, amount=%', 
    payment_ref, new_status, payment_amount;

  -- Find the order by payment reference
  SELECT 
    o.id,
    o.order_number,
    o.status,
    o.payment_status,
    o.total_amount,
    o.delivery_fee,
    o.customer_email,
    o.order_type,
    o.payment_reference,
    o.customer_id
  INTO v_order_record
  FROM orders o
  WHERE o.payment_reference = payment_ref
  LIMIT 1;

  -- If not found, raise exception
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found for payment reference: %', payment_ref;
  END IF;

  -- Validate payment amount if provided
  IF payment_amount IS NOT NULL THEN
    DECLARE
      v_expected_amount NUMERIC;
      v_amount_difference NUMERIC;
    BEGIN
      v_expected_amount := COALESCE(v_order_record.total_amount, 0) + COALESCE(v_order_record.delivery_fee, 0);
      v_amount_difference := ABS(payment_amount - v_expected_amount);
      
      -- Allow 1 kobo tolerance for rounding
      IF v_amount_difference > 0.01 THEN
        -- Log security incident for amount mismatch
        INSERT INTO security_incidents (
          type,
          description,
          severity,
          reference,
          expected_amount,
          received_amount,
          created_at
        ) VALUES (
          'payment_amount_mismatch',
          format('Payment amount mismatch: paid ₦%s, expected ₦%s', payment_amount, v_expected_amount),
          'critical',
          payment_ref,
          v_expected_amount,
          payment_amount,
          NOW()
        );
        
        RAISE EXCEPTION 'Payment amount mismatch: paid ₦%, expected ₦%', payment_amount, v_expected_amount;
      END IF;
    END;
  END IF;

  -- Update the order status and payment information
  UPDATE orders 
  SET 
    status = new_status,
    payment_status = 'paid',
    paid_at = COALESCE(paid_at, NOW()),
    updated_at = NOW()
  WHERE id = v_order_record.id
  RETURNING 
    id,
    order_number,
    status,
    total_amount + COALESCE(delivery_fee, 0) as amount,
    customer_email,
    order_type,
    payment_reference,
    updated_at
  INTO v_updated_order;

  -- Create or update payment transaction record
  INSERT INTO payment_transactions (
    order_id,
    reference,
    provider_reference,
    amount,
    currency,
    status,
    gateway_response,
    verified_at,
    created_at,
    updated_at
  ) VALUES (
    v_updated_order.id,
    payment_ref,
    payment_ref,
    COALESCE(payment_amount, v_updated_order.amount),
    'NGN',
    'completed',
    payment_gateway_response,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (reference) 
  DO UPDATE SET
    status = 'completed',
    gateway_response = EXCLUDED.gateway_response,
    verified_at = NOW(),
    updated_at = NOW();

  -- Log successful verification
  RAISE NOTICE '[VERIFY_PAYMENT_RPC] Payment verified successfully: order_id=%, order_number=%, status=%', 
    v_updated_order.id, v_updated_order.order_number, v_updated_order.status;

  -- Return the updated order information
  RETURN QUERY
  SELECT 
    v_updated_order.id as order_id,
    v_updated_order.order_number,
    v_updated_order.status,
    v_updated_order.amount,
    v_updated_order.customer_email,
    v_updated_order.order_type,
    v_updated_order.payment_reference,
    v_updated_order.updated_at;

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    RAISE NOTICE '[VERIFY_PAYMENT_RPC] Error processing payment: %', SQLERRM;
    
    -- Create error payment transaction record
    INSERT INTO payment_transactions (
      reference,
      provider_reference,
      amount,
      currency,
      status,
      gateway_response,
      created_at,
      updated_at
    ) VALUES (
      payment_ref,
      payment_ref,
      COALESCE(payment_amount, 0),
      'NGN',
      'error',
      jsonb_build_object('error', SQLERRM, 'timestamp', NOW()),
      NOW(),
      NOW()
    )
    ON CONFLICT (reference) DO NOTHING;
    
    -- Re-raise the exception
    RAISE;
END;
$$;

-- PART 2: Backfill Function for Missing Payment Records
-- =====================================================

CREATE OR REPLACE FUNCTION public.backfill_missing_payment_records()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_order_record RECORD;
  v_processed_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_result JSON;
BEGIN
  RAISE NOTICE '[BACKFILL] Starting backfill of missing payment transaction records...';

  -- Find orders that are paid/confirmed but missing payment transaction records
  FOR v_order_record IN
    SELECT DISTINCT 
      o.id, 
      o.order_number, 
      o.payment_reference, 
      o.total_amount,
      o.delivery_fee,
      o.status,
      o.payment_status,
      o.paid_at,
      o.created_at
    FROM orders o
    WHERE 
      (o.status = 'confirmed' OR o.payment_status = 'paid')
      AND o.payment_reference IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM payment_transactions pt 
        WHERE pt.order_id = o.id 
           OR pt.reference = o.payment_reference
           OR pt.provider_reference = o.payment_reference
      )
      AND o.created_at > NOW() - INTERVAL '30 days' -- Only process recent orders
    ORDER BY o.created_at DESC
  LOOP
    BEGIN
      -- Create payment transaction record
      INSERT INTO payment_transactions (
        order_id,
        reference,
        provider_reference,
        amount,
        currency,
        status,
        gateway_response,
        verified_at,
        created_at,
        updated_at
      ) VALUES (
        v_order_record.id,
        v_order_record.payment_reference,
        v_order_record.payment_reference,
        COALESCE(v_order_record.total_amount, 0) + COALESCE(v_order_record.delivery_fee, 0),
        'NGN',
        'completed',
        jsonb_build_object(
          'backfill', true,
          'backfill_timestamp', NOW(),
          'original_order_status', v_order_record.status,
          'original_payment_status', v_order_record.payment_status,
          'order_created_at', v_order_record.created_at
        ),
        COALESCE(v_order_record.paid_at, NOW()),
        v_order_record.created_at,
        NOW()
      );

      v_processed_count := v_processed_count + 1;
      RAISE NOTICE '[BACKFILL] Created payment record for order: %', v_order_record.order_number;

    EXCEPTION
      WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        v_errors := array_append(v_errors, format('Order %s: %s', v_order_record.order_number, SQLERRM));
        RAISE NOTICE '[BACKFILL] Error processing order %: %', v_order_record.order_number, SQLERRM;
    END;
  END LOOP;

  -- Return summary
  SELECT json_build_object(
    'success', true,
    'processed_orders', v_processed_count,
    'error_count', v_error_count,
    'errors', v_errors,
    'timestamp', NOW()
  ) INTO v_result;

  RAISE NOTICE '[BACKFILL] Completed: processed=%, errors=%', v_processed_count, v_error_count;
  RETURN v_result;
END;
$$;

-- PART 3: Fix Inconsistent Order/Payment Statuses
-- ===============================================

CREATE OR REPLACE FUNCTION public.fix_inconsistent_order_statuses()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_order_record RECORD;
  v_fixed_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_result JSON;
BEGIN
  RAISE NOTICE '[STATUS_FIX] Starting fix of inconsistent order statuses...';

  -- Fix orders that are paid but not confirmed
  FOR v_order_record IN
    SELECT DISTINCT 
      o.id, 
      o.order_number, 
      o.status,
      o.payment_status,
      o.payment_reference
    FROM orders o
    WHERE 
      o.payment_status = 'paid' 
      AND o.status != 'confirmed'
      AND o.created_at > NOW() - INTERVAL '30 days'
  LOOP
    BEGIN
      UPDATE orders 
      SET 
        status = 'confirmed',
        updated_at = NOW()
      WHERE id = v_order_record.id;

      v_fixed_count := v_fixed_count + 1;
      RAISE NOTICE '[STATUS_FIX] Fixed order status: % (paid -> confirmed)', v_order_record.order_number;

    EXCEPTION
      WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        v_errors := array_append(v_errors, format('Order %s: %s', v_order_record.order_number, SQLERRM));
    END;
  END LOOP;

  -- Fix orders that are confirmed but not marked as paid (and have payment records)
  FOR v_order_record IN
    SELECT DISTINCT 
      o.id, 
      o.order_number, 
      o.status,
      o.payment_status,
      o.payment_reference
    FROM orders o
    WHERE 
      o.status = 'confirmed' 
      AND o.payment_status != 'paid'
      AND EXISTS (
        SELECT 1 FROM payment_transactions pt 
        WHERE (pt.order_id = o.id OR pt.reference = o.payment_reference)
          AND pt.status IN ('completed', 'paid')
      )
      AND o.created_at > NOW() - INTERVAL '30 days'
  LOOP
    BEGIN
      UPDATE orders 
      SET 
        payment_status = 'paid',
        paid_at = COALESCE(paid_at, NOW()),
        updated_at = NOW()
      WHERE id = v_order_record.id;

      v_fixed_count := v_fixed_count + 1;
      RAISE NOTICE '[STATUS_FIX] Fixed payment status: % (confirmed -> paid)', v_order_record.order_number;

    EXCEPTION
      WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        v_errors := array_append(v_errors, format('Order %s: %s', v_order_record.order_number, SQLERRM));
    END;
  END LOOP;

  -- Return summary
  SELECT json_build_object(
    'success', true,
    'fixed_orders', v_fixed_count,
    'error_count', v_error_count,
    'errors', v_errors,
    'timestamp', NOW()
  ) INTO v_result;

  RAISE NOTICE '[STATUS_FIX] Completed: fixed=%, errors=%', v_fixed_count, v_error_count;
  RETURN v_result;
END;
$$;

-- PART 4: Comprehensive Production Fix Function
-- ============================================

CREATE OR REPLACE FUNCTION public.run_comprehensive_payment_fix()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_backfill_result JSON;
  v_status_fix_result JSON;
  v_final_result JSON;
BEGIN
  RAISE NOTICE '[COMPREHENSIVE_FIX] Starting comprehensive payment system fix...';

  -- Step 1: Backfill missing payment records
  SELECT public.backfill_missing_payment_records() INTO v_backfill_result;

  -- Step 2: Fix inconsistent statuses
  SELECT public.fix_inconsistent_order_statuses() INTO v_status_fix_result;

  -- Combine results
  SELECT json_build_object(
    'success', true,
    'backfill_results', v_backfill_result,
    'status_fix_results', v_status_fix_result,
    'timestamp', NOW(),
    'message', 'Comprehensive payment fix completed successfully'
  ) INTO v_final_result;

  RAISE NOTICE '[COMPREHENSIVE_FIX] All fixes completed successfully';
  RETURN v_final_result;
END;
$$;

-- PART 5: Grant Permissions
-- ========================

GRANT EXECUTE ON FUNCTION public.verify_and_update_payment_status TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backfill_missing_payment_records TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fix_inconsistent_order_statuses TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_comprehensive_payment_fix TO anon, authenticated, service_role;

-- PART 6: Ensure Required Tables Exist
-- ====================================

-- Ensure security_incidents table exists
CREATE TABLE IF NOT EXISTS public.security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  reference TEXT,
  expected_amount NUMERIC,
  received_amount NUMERIC,
  metadata JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on security incidents
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

-- Create policies for security incidents
DO $$
BEGIN
  -- Check if policies exist before creating them
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'security_incidents' AND policyname = 'Admin access to security incidents') THEN
    CREATE POLICY "Admin access to security incidents" 
      ON public.security_incidents 
      FOR ALL 
      USING (is_admin()) 
      WITH CHECK (is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'security_incidents' AND policyname = 'Service role access to security incidents') THEN
    CREATE POLICY "Service role access to security incidents" 
      ON public.security_incidents 
      FOR ALL 
      USING (auth.role() = 'service_role') 
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON public.security_incidents(type);
CREATE INDEX IF NOT EXISTS idx_security_incidents_reference ON public.security_incidents(reference);
CREATE INDEX IF NOT EXISTS idx_security_incidents_created_at ON public.security_incidents(created_at);

-- Ensure payment_transactions table has proper constraints
ALTER TABLE public.payment_transactions 
  ADD CONSTRAINT IF NOT EXISTS payment_transactions_reference_unique UNIQUE (reference);

-- Add helpful indexes for payment lookups
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON public.payment_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_reference ON public.payment_transactions(provider_reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);

-- Add indexes for orders table payment lookups
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON public.orders(payment_reference);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_status_payment_status ON public.orders(status, payment_status);

-- PART 7: Add Comments for Documentation
-- ======================================

COMMENT ON FUNCTION public.verify_and_update_payment_status IS 
'Securely verifies and updates payment status for orders. Used by payment verification edge functions.';

COMMENT ON FUNCTION public.backfill_missing_payment_records IS 
'Creates missing payment transaction records for orders that were successfully paid but lack proper database entries.';

COMMENT ON FUNCTION public.fix_inconsistent_order_statuses IS 
'Fixes inconsistent order and payment statuses by aligning them based on existing data.';

COMMENT ON FUNCTION public.run_comprehensive_payment_fix IS 
'Runs a comprehensive fix of all payment system issues including missing records and inconsistent statuses.';
