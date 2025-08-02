-- Phase 1: Production-Ready Promotion System with Core Triggers and Logic

-- 1. Create promotion usage audit table
CREATE TABLE IF NOT EXISTS promotion_usage_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  order_id UUID,
  customer_email TEXT,
  usage_type TEXT NOT NULL, -- 'applied', 'reverted', 'expired'
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  original_order_amount NUMERIC,
  final_order_amount NUMERIC,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create promotion performance analytics table
CREATE TABLE IF NOT EXISTS promotion_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_usage INTEGER DEFAULT 0,
  total_discount_given NUMERIC DEFAULT 0,
  total_revenue_impact NUMERIC DEFAULT 0,
  unique_customers INTEGER DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  avg_order_value NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(promotion_id, date)
);

-- 3. Create BOGO (Buy One Get One) tracking table
CREATE TABLE IF NOT EXISTS bogo_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  order_id UUID,
  product_id UUID NOT NULL REFERENCES products(id),
  paid_quantity INTEGER NOT NULL DEFAULT 0,
  free_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Add promotion validation function
CREATE OR REPLACE FUNCTION validate_promotion_usage(
  p_promotion_id UUID,
  p_order_amount NUMERIC,
  p_customer_email TEXT DEFAULT NULL,
  p_promotion_code TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promotion RECORD;
  v_current_usage INTEGER;
  v_customer_usage INTEGER;
  v_result JSONB;
BEGIN
  -- Get promotion details
  SELECT * INTO v_promotion
  FROM promotions
  WHERE id = p_promotion_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Promotion not found'
    );
  END IF;
  
  -- Check if promotion is active
  IF v_promotion.status != 'active' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Promotion is not active'
    );
  END IF;
  
  -- Check if promotion has started
  IF v_promotion.valid_from > NOW() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Promotion has not started yet'
    );
  END IF;
  
  -- Check if promotion has expired
  IF v_promotion.valid_until IS NOT NULL AND v_promotion.valid_until < NOW() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Promotion has expired'
    );
  END IF;
  
  -- Check minimum order amount
  IF v_promotion.min_order_amount IS NOT NULL AND p_order_amount < v_promotion.min_order_amount THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Order amount does not meet minimum requirement'
    );
  END IF;
  
  -- Check promotion code if required
  IF v_promotion.code IS NOT NULL AND (p_promotion_code IS NULL OR v_promotion.code != p_promotion_code) THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid promotion code'
    );
  END IF;
  
  -- Check usage limits
  IF v_promotion.usage_limit IS NOT NULL THEN
    SELECT COALESCE(usage_count, 0) INTO v_current_usage
    FROM promotions
    WHERE id = p_promotion_id;
    
    IF v_current_usage >= v_promotion.usage_limit THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'Promotion usage limit reached'
      );
    END IF;
  END IF;
  
  -- Check customer-specific usage (prevent abuse)
  IF p_customer_email IS NOT NULL THEN
    SELECT COUNT(*) INTO v_customer_usage
    FROM promotion_usage_audit
    WHERE promotion_id = p_promotion_id
    AND customer_email = p_customer_email
    AND usage_type = 'applied'
    AND created_at > NOW() - INTERVAL '24 hours';
    
    IF v_customer_usage >= 3 THEN -- Max 3 uses per customer per day
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'Daily usage limit reached for this customer'
      );
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'promotion', row_to_json(v_promotion)
  );
END;
$$;

-- 5. Create function to calculate BOGO discount
CREATE OR REPLACE FUNCTION calculate_bogo_discount(
  p_promotion_id UUID,
  p_cart_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promotion RECORD;
  v_item JSONB;
  v_eligible_items JSONB[] := '{}';
  v_total_discount NUMERIC := 0;
  v_bogo_allocations JSONB[] := '{}';
  v_paid_qty INTEGER;
  v_free_qty INTEGER;
  v_item_discount NUMERIC;
BEGIN
  -- Get promotion details
  SELECT * INTO v_promotion
  FROM promotions
  WHERE id = p_promotion_id AND type = 'bogo';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('discount_amount', 0, 'allocations', '[]'::jsonb);
  END IF;
  
  -- Process each cart item for BOGO eligibility
  FOR v_item IN SELECT jsonb_array_elements(p_cart_items)
  LOOP
    -- Check if item is eligible for this promotion
    IF (v_promotion.applicable_products IS NULL OR 
        array_length(v_promotion.applicable_products, 1) = 0 OR
        (v_item->>'product_id')::UUID = ANY(v_promotion.applicable_products)) THEN
      
      -- Calculate BOGO allocation
      v_paid_qty := (v_item->>'quantity')::INTEGER;
      v_free_qty := v_paid_qty / 2; -- Simple BOGO: buy 2, get 1 free
      
      IF v_free_qty > 0 THEN
        v_item_discount := v_free_qty * (v_item->>'price')::NUMERIC;
        v_total_discount := v_total_discount + v_item_discount;
        
        v_bogo_allocations := v_bogo_allocations || jsonb_build_object(
          'product_id', v_item->>'product_id',
          'paid_quantity', v_paid_qty - v_free_qty,
          'free_quantity', v_free_qty,
          'discount_amount', v_item_discount
        );
      END IF;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'discount_amount', v_total_discount,
    'allocations', array_to_json(v_bogo_allocations)
  );
END;
$$;

-- 6. Create function to increment promotion usage with audit
CREATE OR REPLACE FUNCTION increment_promotion_usage(
  p_promotion_id UUID,
  p_order_id UUID,
  p_customer_email TEXT,
  p_discount_amount NUMERIC,
  p_original_amount NUMERIC,
  p_final_amount NUMERIC,
  p_metadata JSONB DEFAULT '{}'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Increment usage count atomically
  UPDATE promotions
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = p_promotion_id;
  
  -- Log usage in audit table
  INSERT INTO promotion_usage_audit (
    promotion_id, order_id, customer_email, usage_type,
    discount_amount, original_order_amount, final_order_amount, metadata
  ) VALUES (
    p_promotion_id, p_order_id, p_customer_email, 'applied',
    p_discount_amount, p_original_amount, p_final_amount, p_metadata
  );
  
  -- Update analytics
  INSERT INTO promotion_analytics (
    promotion_id, date, total_usage, total_discount_given, total_revenue_impact
  ) VALUES (
    p_promotion_id, CURRENT_DATE, 1, p_discount_amount, p_final_amount
  )
  ON CONFLICT (promotion_id, date)
  DO UPDATE SET
    total_usage = promotion_analytics.total_usage + 1,
    total_discount_given = promotion_analytics.total_discount_given + p_discount_amount,
    total_revenue_impact = promotion_analytics.total_revenue_impact + p_final_amount,
    updated_at = NOW();
END;
$$;

-- 7. Create trigger to auto-expire promotions
CREATE OR REPLACE FUNCTION check_promotion_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if promotion should be expired
  IF NEW.valid_until IS NOT NULL AND NEW.valid_until <= NOW() AND NEW.status = 'active' THEN
    NEW.status = 'expired';
    
    -- Log expiration
    INSERT INTO promotion_usage_audit (
      promotion_id, usage_type, metadata
    ) VALUES (
      NEW.id, 'expired', 
      jsonb_build_object('auto_expired_at', NOW(), 'reason', 'time_based')
    );
  END IF;
  
  -- Check if usage limit reached
  IF NEW.usage_limit IS NOT NULL AND NEW.usage_count >= NEW.usage_limit AND NEW.status = 'active' THEN
    NEW.status = 'expired';
    
    -- Log expiration
    INSERT INTO promotion_usage_audit (
      promotion_id, usage_type, metadata
    ) VALUES (
      NEW.id, 'expired',
      jsonb_build_object('auto_expired_at', NOW(), 'reason', 'usage_limit_reached')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_check_promotion_expiration ON promotions;
CREATE TRIGGER trigger_check_promotion_expiration
  BEFORE UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION check_promotion_expiration();

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_promotion_usage_audit_promotion_id ON promotion_usage_audit(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_audit_customer_email ON promotion_usage_audit(customer_email);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_audit_created_at ON promotion_usage_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_promotion_analytics_promotion_date ON promotion_analytics(promotion_id, date);
CREATE INDEX IF NOT EXISTS idx_bogo_allocations_promotion_order ON bogo_allocations(promotion_id, order_id);

-- 9. Add RLS policies
ALTER TABLE promotion_usage_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE bogo_allocations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for promotion_usage_audit
CREATE POLICY "Admins can view all promotion usage audit"
  ON promotion_usage_audit FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Service roles can manage promotion usage audit"
  ON promotion_usage_audit FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for promotion_analytics
CREATE POLICY "Admins can view promotion analytics"
  ON promotion_analytics FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Service roles can manage promotion analytics"
  ON promotion_analytics FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for bogo_allocations
CREATE POLICY "Admins can view BOGO allocations"
  ON bogo_allocations FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Service roles can manage BOGO allocations"
  ON bogo_allocations FOR ALL
  TO service_role
  USING (true);