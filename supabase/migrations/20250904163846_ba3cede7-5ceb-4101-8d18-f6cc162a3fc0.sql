-- Fix function search path security issues
CREATE OR REPLACE FUNCTION public.check_promotion_code_rate_limit(
  p_identifier TEXT,
  p_max_attempts INTEGER DEFAULT 10,
  p_window_hours INTEGER DEFAULT 1,
  p_block_minutes INTEGER DEFAULT 15
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_window TIMESTAMP WITH TIME ZONE;
  v_rate_limit_record RECORD;
BEGIN
  v_current_window := date_trunc('hour', NOW());
  
  -- Get existing rate limit record for current hour
  SELECT * INTO v_rate_limit_record
  FROM promotion_code_rate_limits
  WHERE identifier = p_identifier
  AND window_hour = v_current_window;
  
  -- Check if currently blocked
  IF v_rate_limit_record.blocked_until IS NOT NULL 
     AND v_rate_limit_record.blocked_until > NOW() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'temporarily_blocked',
      'blocked_until', v_rate_limit_record.blocked_until,
      'attempts_remaining', 0
    );
  END IF;
  
  -- If no record exists, create one
  IF v_rate_limit_record IS NULL THEN
    INSERT INTO promotion_code_rate_limits (identifier, window_hour, attempt_count)
    VALUES (p_identifier, v_current_window, 1)
    ON CONFLICT (identifier, window_hour)
    DO UPDATE SET attempt_count = promotion_code_rate_limits.attempt_count + 1,
                  updated_at = NOW();
    
    RETURN jsonb_build_object(
      'allowed', true,
      'attempts_remaining', p_max_attempts - 1
    );
  END IF;
  
  -- Check if within rate limit
  IF v_rate_limit_record.attempt_count >= p_max_attempts THEN
    -- Block for specified minutes
    UPDATE promotion_code_rate_limits
    SET blocked_until = NOW() + (p_block_minutes || ' minutes')::INTERVAL,
        updated_at = NOW()
    WHERE id = v_rate_limit_record.id;
    
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limit_exceeded',
      'blocked_until', NOW() + (p_block_minutes || ' minutes')::INTERVAL,
      'attempts_remaining', 0
    );
  END IF;
  
  -- Increment attempt count
  UPDATE promotion_code_rate_limits
  SET attempt_count = attempt_count + 1,
      updated_at = NOW()
  WHERE id = v_rate_limit_record.id;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'attempts_remaining', p_max_attempts - (v_rate_limit_record.attempt_count + 1)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_promotion_code_secure(
  p_code TEXT,
  p_order_amount NUMERIC,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promotion RECORD;
  v_usage_count INTEGER;
  v_customer_usage_count INTEGER;
  v_discount_amount NUMERIC := 0;
  v_current_date TIMESTAMP WITH TIME ZONE := NOW();
  v_current_day TEXT := to_char(v_current_date, 'Day');
BEGIN
  -- Input validation
  IF p_code IS NULL OR trim(p_code) = '' THEN
    -- Log security audit
    INSERT INTO promotion_security_audit (
      action_type, failure_reason, customer_email, customer_id, 
      ip_address, user_agent, order_amount, metadata
    ) VALUES (
      'failure', 'empty_code', p_customer_email, p_customer_id,
      p_ip_address, p_user_agent, p_order_amount,
      jsonb_build_object('code_attempted', p_code)
    );
    
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Please enter a promotion code'
    );
  END IF;
  
  -- Get promotion details
  SELECT * INTO v_promotion
  FROM promotions
  WHERE UPPER(code) = UPPER(trim(p_code))
  AND status = 'active';
  
  IF NOT FOUND THEN
    -- Log failed attempt
    INSERT INTO promotion_security_audit (
      action_type, failure_reason, customer_email, customer_id,
      ip_address, user_agent, order_amount, metadata
    ) VALUES (
      'failure', 'invalid_code', p_customer_email, p_customer_id,
      p_ip_address, p_user_agent, p_order_amount,
      jsonb_build_object('code_attempted', p_code)
    );
    
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid promotion code'
    );
  END IF;
  
  -- Check date validity
  IF v_current_date < v_promotion.valid_from THEN
    INSERT INTO promotion_security_audit (
      promotion_id, action_type, failure_reason, customer_email, customer_id,
      ip_address, user_agent, order_amount, metadata
    ) VALUES (
      v_promotion.id, 'failure', 'not_yet_active', p_customer_email, p_customer_id,
      p_ip_address, p_user_agent, p_order_amount,
      jsonb_build_object('valid_from', v_promotion.valid_from)
    );
    
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'This promotion is not yet active'
    );
  END IF;
  
  IF v_promotion.valid_until IS NOT NULL AND v_current_date > v_promotion.valid_until THEN
    INSERT INTO promotion_security_audit (
      promotion_id, action_type, failure_reason, customer_email, customer_id,
      ip_address, user_agent, order_amount, metadata
    ) VALUES (
      v_promotion.id, 'failure', 'expired', p_customer_email, p_customer_id,
      p_ip_address, p_user_agent, p_order_amount,
      jsonb_build_object('valid_until', v_promotion.valid_until)
    );
    
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'This promotion has expired'
    );
  END IF;
  
  -- Check day of week validity (if applicable_days is set)
  IF v_promotion.applicable_days IS NOT NULL 
     AND array_length(v_promotion.applicable_days, 1) > 0 
     AND NOT (trim(v_current_day) = ANY(v_promotion.applicable_days)) THEN
    INSERT INTO promotion_security_audit (
      promotion_id, action_type, failure_reason, customer_email, customer_id,
      ip_address, user_agent, order_amount, metadata
    ) VALUES (
      v_promotion.id, 'failure', 'invalid_day', p_customer_email, p_customer_id,
      p_ip_address, p_user_agent, p_order_amount,
      jsonb_build_object('current_day', v_current_day, 'applicable_days', v_promotion.applicable_days)
    );
    
    RETURN jsonb_build_object(
      'valid', false,
      'error', format('This promotion is not available on %s', trim(v_current_day))
    );
  END IF;
  
  -- Check minimum order amount
  IF v_promotion.min_order_amount IS NOT NULL AND p_order_amount < v_promotion.min_order_amount THEN
    INSERT INTO promotion_security_audit (
      promotion_id, action_type, failure_reason, customer_email, customer_id,
      ip_address, user_agent, order_amount, metadata
    ) VALUES (
      v_promotion.id, 'failure', 'min_order_not_met', p_customer_email, p_customer_id,
      p_ip_address, p_user_agent, p_order_amount,
      jsonb_build_object('required_amount', v_promotion.min_order_amount)
    );
    
    RETURN jsonb_build_object(
      'valid', false,
      'error', format('Minimum order amount of ₦%s required', v_promotion.min_order_amount)
    );
  END IF;
  
  -- Check global usage limit
  IF v_promotion.usage_limit IS NOT NULL THEN
    SELECT COALESCE(COUNT(*), 0) INTO v_usage_count
    FROM promotion_usage
    WHERE promotion_id = v_promotion.id;
    
    IF v_usage_count >= v_promotion.usage_limit THEN
      INSERT INTO promotion_security_audit (
        promotion_id, action_type, failure_reason, customer_email, customer_id,
        ip_address, user_agent, order_amount, metadata
      ) VALUES (
        v_promotion.id, 'failure', 'usage_limit_exceeded', p_customer_email, p_customer_id,
        p_ip_address, p_user_agent, p_order_amount,
        jsonb_build_object('usage_count', v_usage_count, 'usage_limit', v_promotion.usage_limit)
      );
      
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'This promotion has reached its usage limit'
      );
    END IF;
  END IF;
  
  -- Check per-customer usage (assuming max 1 use per customer for most promos)
  IF p_customer_email IS NOT NULL THEN
    SELECT COALESCE(COUNT(*), 0) INTO v_customer_usage_count
    FROM promotion_usage
    WHERE promotion_id = v_promotion.id
    AND customer_email = p_customer_email;
    
    IF v_customer_usage_count > 0 THEN
      INSERT INTO promotion_security_audit (
        promotion_id, action_type, failure_reason, customer_email, customer_id,
        ip_address, user_agent, order_amount, metadata
      ) VALUES (
        v_promotion.id, 'failure', 'already_used_by_customer', p_customer_email, p_customer_id,
        p_ip_address, p_user_agent, p_order_amount,
        jsonb_build_object('customer_usage_count', v_customer_usage_count)
      );
      
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'You have already used this promotion code'
      );
    END IF;
  END IF;
  
  -- Calculate discount amount
  CASE v_promotion.type
    WHEN 'percentage' THEN
      v_discount_amount := (p_order_amount * v_promotion.value) / 100;
      IF v_promotion.max_discount_amount IS NOT NULL THEN
        v_discount_amount := LEAST(v_discount_amount, v_promotion.max_discount_amount);
      END IF;
    WHEN 'fixed_amount' THEN
      v_discount_amount := LEAST(v_promotion.value, p_order_amount);
    WHEN 'free_delivery' THEN
      v_discount_amount := 0; -- Handled separately in delivery calculation
    WHEN 'buy_one_get_one' THEN
      v_discount_amount := 0; -- Handled separately in cart logic
    ELSE
      v_discount_amount := 0;
  END CASE;
  
  -- Log successful validation
  INSERT INTO promotion_security_audit (
    promotion_id, action_type, customer_email, customer_id,
    ip_address, user_agent, order_amount, discount_calculated, metadata
  ) VALUES (
    v_promotion.id, 'success', p_customer_email, p_customer_id,
    p_ip_address, p_user_agent, p_order_amount, v_discount_amount,
    jsonb_build_object('promotion_type', v_promotion.type, 'promotion_value', v_promotion.value)
  );
  
  RETURN jsonb_build_object(
    'valid', true,
    'promotion', row_to_json(v_promotion),
    'discount_amount', v_discount_amount,
    'message', format('Promotion "%s" applied successfully!', v_promotion.name)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_promotion_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete records older than 24 hours
  DELETE FROM promotion_code_rate_limits
  WHERE window_hour < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log cleanup
  INSERT INTO audit_logs (
    action, category, message, new_values
  ) VALUES (
    'promotion_rate_limit_cleanup',
    'System Maintenance',
    'Cleaned up old promotion rate limit records',
    jsonb_build_object('deleted_count', deleted_count)
  );
  
  RETURN deleted_count;
END;
$$;