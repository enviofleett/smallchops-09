-- Create payment system health monitoring view
CREATE OR REPLACE VIEW payment_system_health AS
WITH payment_stats AS (
  SELECT 
    COUNT(*) as total_transactions,
    COUNT(*) FILTER (WHERE status = 'paid') as successful_payments,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_payments,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_payments,
    AVG(amount) as avg_transaction_amount,
    MAX(created_at) as last_transaction_time
  FROM payment_transactions 
  WHERE created_at >= NOW() - INTERVAL '24 hours'
),
order_stats AS (
  SELECT 
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE payment_status = 'paid') as paid_orders,
    COUNT(*) FILTER (WHERE payment_status = 'pending') as pending_orders,
    COUNT(*) FILTER (WHERE payment_status = 'failed') as failed_orders
  FROM orders 
  WHERE created_at >= NOW() - INTERVAL '24 hours'
),
error_stats AS (
  SELECT 
    COUNT(*) as payment_errors,
    COUNT(*) FILTER (WHERE type = 'amount_mismatch') as amount_mismatches,
    COUNT(*) FILTER (WHERE type = 'reference_validation_failed') as reference_errors
  FROM security_incidents 
  WHERE created_at >= NOW() - INTERVAL '24 hours'
    AND (type LIKE '%payment%' OR type LIKE '%amount%' OR type LIKE '%reference%')
)
SELECT 
  ps.total_transactions,
  ps.successful_payments,
  ps.failed_payments,
  ps.pending_payments,
  ps.avg_transaction_amount,
  ps.last_transaction_time,
  os.total_orders,
  os.paid_orders,
  os.pending_orders,
  os.failed_orders,
  es.payment_errors,
  es.amount_mismatches,
  es.reference_errors,
  CASE 
    WHEN ps.total_transactions = 0 THEN 0
    ELSE ROUND((ps.successful_payments::decimal / ps.total_transactions) * 100, 2)
  END as success_rate_percent,
  CASE 
    WHEN os.total_orders = 0 THEN 0
    ELSE ROUND((os.paid_orders::decimal / os.total_orders) * 100, 2)
  END as order_completion_rate_percent,
  CASE
    WHEN ps.successful_payments >= 10 AND es.payment_errors <= 5 THEN 'healthy'
    WHEN ps.successful_payments >= 5 AND es.payment_errors <= 10 THEN 'warning'
    ELSE 'critical'
  END as health_status,
  NOW() as calculated_at
FROM payment_stats ps
CROSS JOIN order_stats os  
CROSS JOIN error_stats es;

-- Create function to get payment health summary
CREATE OR REPLACE FUNCTION get_payment_health_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  health_data RECORD;
  result jsonb;
BEGIN
  -- Only allow admin access
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  SELECT * INTO health_data FROM payment_system_health;
  
  result := jsonb_build_object(
    'overall_health', health_data.health_status,
    'success_rate', health_data.success_rate_percent,
    'order_completion_rate', health_data.order_completion_rate_percent,
    'transactions', jsonb_build_object(
      'total', health_data.total_transactions,
      'successful', health_data.successful_payments,
      'failed', health_data.failed_payments,
      'pending', health_data.pending_payments
    ),
    'orders', jsonb_build_object(
      'total', health_data.total_orders,
      'paid', health_data.paid_orders,
      'pending', health_data.pending_orders,
      'failed', health_data.failed_orders
    ),
    'errors', jsonb_build_object(
      'total', health_data.payment_errors,
      'amount_mismatches', health_data.amount_mismatches,
      'reference_errors', health_data.reference_errors
    ),
    'last_transaction', health_data.last_transaction_time,
    'calculated_at', health_data.calculated_at
  );
  
  RETURN result;
END;
$$;