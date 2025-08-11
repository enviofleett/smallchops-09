-- Fix database security warnings before production launch

-- 1. Enable leaked password protection for better security
UPDATE auth.config 
SET leaked_password_protection = true
WHERE key = 'password_policy';

-- Insert the setting if it doesn't exist
INSERT INTO auth.config (key, value)
VALUES ('password_policy', '{"leaked_password_protection": true}')
ON CONFLICT (key) DO UPDATE SET
value = jsonb_set(value, '{leaked_password_protection}', 'true');

-- 2. Create proper validation for order completion workflow
CREATE OR REPLACE FUNCTION validate_order_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure paid orders can progress to completed status
  IF NEW.status = 'completed' AND OLD.payment_status != 'paid' THEN
    RAISE EXCEPTION 'Orders can only be completed after payment is confirmed';
  END IF;
  
  -- Auto-complete delivered orders after 24 hours (production safety)
  IF NEW.status = 'delivered' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW() + INTERVAL '24 hours';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to orders table
DROP TRIGGER IF EXISTS validate_order_completion_trigger ON orders;
CREATE TRIGGER validate_order_completion_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_completion();

-- 3. Add production monitoring for payment health
CREATE TABLE IF NOT EXISTS production_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  threshold_value NUMERIC,
  is_healthy BOOLEAN NOT NULL DEFAULT true,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_production_health_metrics_metric_name 
ON production_health_metrics(metric_name, measured_at DESC);

-- 4. Add production-ready payment success rate monitoring
CREATE OR REPLACE FUNCTION monitor_payment_success_rate()
RETURNS VOID AS $$
DECLARE
  total_payments INTEGER;
  successful_payments INTEGER;
  success_rate NUMERIC;
  is_healthy BOOLEAN;
BEGIN
  -- Calculate 24-hour payment metrics
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status IN ('success', 'paid')) as successful
  INTO total_payments, successful_payments
  FROM payment_transactions 
  WHERE created_at >= NOW() - INTERVAL '24 hours';
  
  -- Calculate success rate
  IF total_payments > 0 THEN
    success_rate := (successful_payments::NUMERIC / total_payments::NUMERIC) * 100;
  ELSE
    success_rate := 100; -- No payments is technically 100% success
  END IF;
  
  -- Determine health (production threshold: 85%)
  is_healthy := (success_rate >= 85.0 OR total_payments = 0);
  
  -- Record metric
  INSERT INTO production_health_metrics (
    metric_name, metric_value, threshold_value, is_healthy
  ) VALUES (
    'payment_success_rate_24h', success_rate, 85.0, is_healthy
  );
  
  -- Alert if unhealthy (can be extended with notifications)
  IF NOT is_healthy THEN
    INSERT INTO audit_logs (action, category, message, new_values)
    VALUES (
      'payment_health_alert',
      'Production Monitoring',
      'Payment success rate below threshold: ' || success_rate || '%',
      jsonb_build_object(
        'success_rate', success_rate,
        'total_payments', total_payments,
        'successful_payments', successful_payments,
        'threshold', 85.0
      )
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Create production-ready order status validation
ALTER TABLE orders 
ADD CONSTRAINT valid_payment_status_enum 
CHECK (payment_status IN ('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded'));

ALTER TABLE orders 
ADD CONSTRAINT valid_order_status_enum 
CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed', 'cancelled', 'refunded'));

-- 6. Ensure payment_transactions have proper constraints
ALTER TABLE payment_transactions 
ADD CONSTRAINT valid_transaction_status 
CHECK (status IN ('pending', 'processing', 'success', 'paid', 'failed', 'cancelled', 'refunded'));

-- 7. Production-ready audit logging
CREATE OR REPLACE FUNCTION log_production_metrics()
RETURNS VOID AS $$
BEGIN
  -- Log daily production metrics
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'daily_production_metrics',
    'Production Monitoring',
    'Daily production health check completed',
    jsonb_build_object(
      'timestamp', NOW(),
      'orders_24h', (SELECT COUNT(*) FROM orders WHERE created_at >= NOW() - INTERVAL '24 hours'),
      'payments_24h', (SELECT COUNT(*) FROM payment_transactions WHERE created_at >= NOW() - INTERVAL '24 hours'),
      'success_rate', (
        SELECT ROUND(
          (COUNT(*) FILTER (WHERE status IN ('success', 'paid'))::NUMERIC / 
           NULLIF(COUNT(*), 0)::NUMERIC) * 100, 2
        )
        FROM payment_transactions 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      )
    )
  );
END;
$$ LANGUAGE plpgsql;