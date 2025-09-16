-- Simple and secure go-live cleanup function
CREATE OR REPLACE FUNCTION public.execute_go_live_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- This allows admin-level access
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Clear operational data in safe order
  
  -- Clear child tables first (to avoid FK violations)
  DELETE FROM order_status_changes;
  DELETE FROM order_delivery_schedule;
  DELETE FROM order_items;
  DELETE FROM payment_transactions;
  DELETE FROM business_analytics;
  DELETE FROM api_metrics;
  DELETE FROM api_request_logs;
  DELETE FROM cron_execution_logs;
  DELETE FROM automation_activity_logs;
  DELETE FROM cart_sessions;
  DELETE FROM cart_abandonment_tracking;
  DELETE FROM communication_events;
  DELETE FROM communication_events_archive;
  DELETE FROM communication_logs;
  
  -- Clear parent table last
  DELETE FROM orders;
  
  -- Clear customer order references for consistency
  UPDATE customer_accounts SET last_order_date = NULL;
  
  -- Log the cleanup
  INSERT INTO audit_logs(action, category, message, new_values)
  VALUES(
    'production_go_live_cleanup',
    'System Maintenance',
    '🚀 Production Go-Live: All operational data cleared successfully',
    jsonb_build_object(
      'executed_at', NOW(),
      'status', 'success',
      'data_preserved', 'customers, products, business_settings, templates'
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', '🚀 SUCCESS! Your system is now production-ready with clean operational data.',
    'preserved_data', 'Customer accounts, products, business settings, and email templates remain intact',
    'cleared_data', 'Orders, payments, communications, analytics, and cart data cleared',
    'executed_at', NOW()
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Handle any errors gracefully
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'Cleanup failed - please contact support'
  );
END;
$$;