-- Final working go-live cleanup - only existing tables
CREATE OR REPLACE FUNCTION public.execute_production_go_live()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Clear operational data - only existing tables
  
  -- Analytics and logs
  DELETE FROM business_analytics WHERE 1=1;
  DELETE FROM api_metrics WHERE 1=1;
  DELETE FROM api_request_logs WHERE 1=1;
  DELETE FROM cron_execution_logs WHERE 1=1;
  DELETE FROM automation_activity_logs WHERE 1=1;
  
  -- Cart and abandonment data
  DELETE FROM cart_sessions WHERE 1=1;
  DELETE FROM cart_abandonment_tracking WHERE 1=1;
  
  -- Communication data
  DELETE FROM communication_events WHERE 1=1;
  DELETE FROM communication_events_archive WHERE 1=1;
  DELETE FROM communication_logs WHERE 1=1;
  
  -- Order related (check if exists and clear in safe FK order)
  DELETE FROM order_status_changes WHERE 1=1;
  DELETE FROM order_delivery_schedule WHERE 1=1;
  DELETE FROM payment_transactions WHERE 1=1;
  DELETE FROM orders WHERE 1=1;
  
  -- Clear customer order references
  UPDATE customer_accounts SET last_order_date = NULL WHERE last_order_date IS NOT NULL;
  
  -- Record success in audit log
  INSERT INTO audit_logs(action, category, message, new_values)
  VALUES(
    'production_go_live_success',
    'System Maintenance',
    '🚀 PRODUCTION GO-LIVE SUCCESSFUL: All operational data cleared',
    jsonb_build_object(
      'executed_at', NOW(),
      'status', 'SUCCESS',
      'message', 'System ready for production use'
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'status', 'PRODUCTION READY! 🚀',
    'message', 'All operational data has been cleared. Your system is now ready for production use.',
    'cleared_data', 'Orders, payments, analytics, communications, cart sessions',
    'preserved_data', 'Customer accounts, products, business settings, email templates',
    'executed_at', NOW()::text
  );
  
END;
$$;