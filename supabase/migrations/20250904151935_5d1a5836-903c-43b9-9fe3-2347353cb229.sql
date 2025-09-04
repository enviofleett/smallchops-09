-- FINAL SIMPLE PRODUCTION GO-LIVE CLEANUP
CREATE OR REPLACE FUNCTION public.clear_production_data()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result text := 'PRODUCTION GO-LIVE CLEANUP RESULTS:\n';
  v_count int;
BEGIN
  -- Clear operational data with counts
  
  -- Business analytics
  SELECT COUNT(*) INTO v_count FROM business_analytics;
  DELETE FROM business_analytics;
  v_result := v_result || '✓ business_analytics: ' || v_count || ' records cleared\n';
  
  -- API data
  SELECT COUNT(*) INTO v_count FROM api_metrics;
  DELETE FROM api_metrics;
  v_result := v_result || '✓ api_metrics: ' || v_count || ' records cleared\n';
  
  SELECT COUNT(*) INTO v_count FROM api_request_logs;
  DELETE FROM api_request_logs;
  v_result := v_result || '✓ api_request_logs: ' || v_count || ' records cleared\n';
  
  -- System logs
  SELECT COUNT(*) INTO v_count FROM cron_execution_logs;
  DELETE FROM cron_execution_logs;
  v_result := v_result || '✓ cron_execution_logs: ' || v_count || ' records cleared\n';
  
  SELECT COUNT(*) INTO v_count FROM automation_activity_logs;
  DELETE FROM automation_activity_logs;
  v_result := v_result || '✓ automation_activity_logs: ' || v_count || ' records cleared\n';
  
  -- Cart data
  SELECT COUNT(*) INTO v_count FROM cart_sessions;
  DELETE FROM cart_sessions;
  v_result := v_result || '✓ cart_sessions: ' || v_count || ' records cleared\n';
  
  SELECT COUNT(*) INTO v_count FROM cart_abandonment_tracking;
  DELETE FROM cart_abandonment_tracking;
  v_result := v_result || '✓ cart_abandonment_tracking: ' || v_count || ' records cleared\n';
  
  -- Communication data
  SELECT COUNT(*) INTO v_count FROM communication_events;
  DELETE FROM communication_events;
  v_result := v_result || '✓ communication_events: ' || v_count || ' records cleared\n';
  
  SELECT COUNT(*) INTO v_count FROM communication_events_archive;
  DELETE FROM communication_events_archive;
  v_result := v_result || '✓ communication_events_archive: ' || v_count || ' records cleared\n';
  
  SELECT COUNT(*) INTO v_count FROM communication_logs;
  DELETE FROM communication_logs;
  v_result := v_result || '✓ communication_logs: ' || v_count || ' records cleared\n';
  
  -- Order data (FK safe order)
  SELECT COUNT(*) INTO v_count FROM order_status_changes;
  DELETE FROM order_status_changes;
  v_result := v_result || '✓ order_status_changes: ' || v_count || ' records cleared\n';
  
  SELECT COUNT(*) INTO v_count FROM order_delivery_schedule;
  DELETE FROM order_delivery_schedule;
  v_result := v_result || '✓ order_delivery_schedule: ' || v_count || ' records cleared\n';
  
  SELECT COUNT(*) INTO v_count FROM order_items;
  DELETE FROM order_items;
  v_result := v_result || '✓ order_items: ' || v_count || ' records cleared\n';
  
  SELECT COUNT(*) INTO v_count FROM orders;
  DELETE FROM orders;
  v_result := v_result || '✓ orders: ' || v_count || ' records cleared\n';
  
  -- Clear customer references
  UPDATE customer_accounts SET last_order_date = NULL WHERE last_order_date IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || '✓ customer_accounts: ' || v_count || ' last_order_date references cleared\n';
  
  v_result := v_result || '\n🚀 PRODUCTION GO-LIVE SUCCESSFUL!\n';
  v_result := v_result || '✅ All operational data cleared\n';
  v_result := v_result || '✅ Customer accounts preserved\n';
  v_result := v_result || '✅ Products and business settings preserved\n';
  v_result := v_result || '✅ Email templates and configurations preserved\n';
  v_result := v_result || '\nYour system is now ready for production use!';
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RETURN 'ERROR during cleanup: ' || SQLERRM || '\nSome tables may not exist or access may be restricted.';
END;
$$;