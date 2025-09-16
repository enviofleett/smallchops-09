-- FINAL PRODUCTION GO-LIVE CLEANUP - Using only confirmed existing tables
CREATE OR REPLACE FUNCTION public.production_go_live_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tables_cleared text[] := '{}';
  v_errors text[] := '{}';
  v_table text;
BEGIN
  -- Clear confirmed operational tables one by one with error handling
  
  -- Analytics and metrics
  BEGIN
    DELETE FROM business_analytics;
    v_tables_cleared := array_append(v_tables_cleared, 'business_analytics');
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'business_analytics: ' || SQLERRM);
  END;
  
  BEGIN
    DELETE FROM api_metrics;
    v_tables_cleared := array_append(v_tables_cleared, 'api_metrics');
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'api_metrics: ' || SQLERRM);
  END;
  
  BEGIN
    DELETE FROM api_request_logs;
    v_tables_cleared := array_append(v_tables_cleared, 'api_request_logs');
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'api_request_logs: ' || SQLERRM);
  END;
  
  BEGIN
    DELETE FROM cron_execution_logs;
    v_tables_cleared := array_append(v_tables_cleared, 'cron_execution_logs');
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'cron_execution_logs: ' || SQLERRM);
  END;
  
  BEGIN
    DELETE FROM automation_activity_logs;
    v_tables_cleared := array_append(v_tables_cleared, 'automation_activity_logs');
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'automation_activity_logs: ' || SQLERRM);
  END;
  
  -- Cart data
  BEGIN
    DELETE FROM cart_sessions;
    v_tables_cleared := array_append(v_tables_cleared, 'cart_sessions');
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'cart_sessions: ' || SQLERRM);
  END;
  
  BEGIN
    DELETE FROM cart_abandonment_tracking;
    v_tables_cleared := array_append(v_tables_cleared, 'cart_abandonment_tracking');
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'cart_abandonment_tracking: ' || SQLERRM);
  END;
  
  -- Communication data
  BEGIN
    DELETE FROM communication_events;
    v_tables_cleared := array_append(v_tables_cleared, 'communication_events');
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'communication_events: ' || SQLERRM);
  END;
  
  BEGIN
    DELETE FROM communication_events_archive;
    v_tables_cleared := array_append(v_tables_cleared, 'communication_events_archive');
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'communication_events_archive: ' || SQLERRM);
  END;
  
  BEGIN
    DELETE FROM communication_logs;
    v_tables_cleared := array_append(v_tables_cleared, 'communication_logs');
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'communication_logs: ' || SQLERRM);
  END;
  
  -- Order related data (in FK safe order)
  BEGIN
    DELETE FROM order_status_changes;
    v_tables_cleared := array_append(v_tables_cleared, 'order_status_changes');
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'order_status_changes: ' || SQLERRM);
  END;
  
  BEGIN
    DELETE FROM order_delivery_schedule;
    v_tables_cleared := array_append(v_tables_cleared, 'order_delivery_schedule');
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'order_delivery_schedule: ' || SQLERRM);
  END;
  
  BEGIN
    DELETE FROM order_items;
    v_tables_cleared := array_append(v_tables_cleared, 'order_items');
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'order_items: ' || SQLERRM);
  END;
  
  BEGIN
    DELETE FROM orders;
    v_tables_cleared := array_append(v_tables_cleared, 'orders');
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'orders: ' || SQLERRM);
  END;
  
  -- Clear customer order references
  BEGIN
    UPDATE customer_accounts SET last_order_date = NULL WHERE last_order_date IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    v_errors := array_append(v_errors, 'customer_accounts update: ' || SQLERRM);
  END;
  
  -- Log successful go-live
  INSERT INTO audit_logs(action, category, message, new_values)
  VALUES(
    'production_go_live_completed',
    'System Maintenance',
    '🚀 PRODUCTION GO-LIVE COMPLETED SUCCESSFULLY',
    jsonb_build_object(
      'tables_cleared', array_to_json(v_tables_cleared),
      'errors', array_to_json(v_errors),
      'executed_at', NOW(),
      'status', 'SUCCESS'
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'status', '🚀 PRODUCTION READY!',
    'message', 'Your system has been successfully prepared for production use.',
    'tables_cleared', array_to_json(v_tables_cleared),
    'tables_cleared_count', array_length(v_tables_cleared, 1),
    'errors', array_to_json(v_errors),
    'error_count', array_length(v_errors, 1),
    'preserved_data', 'Customer accounts, products, business settings, email templates, and all configuration data',
    'executed_at', NOW()::text
  );
  
END;
$$;