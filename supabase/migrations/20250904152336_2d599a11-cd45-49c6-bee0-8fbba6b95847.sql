-- FINAL TARGETED CLEANUP - Only confirmed tables
CREATE OR REPLACE FUNCTION public.execute_go_live()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result text := '🚀 PRODUCTION GO-LIVE CLEANUP COMPLETED!\n\n';
  v_count int;
  v_total_cleared int := 0;
BEGIN
  -- Clear only confirmed existing tables
  
  -- Orders (main operational data)
  SELECT COUNT(*) INTO v_count FROM orders;
  DELETE FROM orders;
  v_result := v_result || '✓ Orders cleared: ' || v_count || ' records\n';
  v_total_cleared := v_total_cleared + v_count;
  
  -- Communication events
  SELECT COUNT(*) INTO v_count FROM communication_events;
  DELETE FROM communication_events;
  v_result := v_result || '✓ Communication events cleared: ' || v_count || ' records\n';
  v_total_cleared := v_total_cleared + v_count;
  
  -- Communication archives
  SELECT COUNT(*) INTO v_count FROM communication_events_archive;
  DELETE FROM communication_events_archive;
  v_result := v_result || '✓ Communication archives cleared: ' || v_count || ' records\n';
  v_total_cleared := v_total_cleared + v_count;
  
  -- Cart sessions
  SELECT COUNT(*) INTO v_count FROM cart_sessions;
  DELETE FROM cart_sessions;
  v_result := v_result || '✓ Cart sessions cleared: ' || v_count || ' records\n';
  v_total_cleared := v_total_cleared + v_count;
  
  -- Business analytics
  SELECT COUNT(*) INTO v_count FROM business_analytics;
  DELETE FROM business_analytics;
  v_result := v_result || '✓ Business analytics cleared: ' || v_count || ' records\n';
  v_total_cleared := v_total_cleared + v_count;
  
  -- API metrics
  SELECT COUNT(*) INTO v_count FROM api_metrics;
  DELETE FROM api_metrics;
  v_result := v_result || '✓ API metrics cleared: ' || v_count || ' records\n';
  v_total_cleared := v_total_cleared + v_count;
  
  -- Clear customer order references
  UPDATE customer_accounts SET last_order_date = NULL WHERE last_order_date IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_result := v_result || '✓ Customer order references cleared: ' || v_count || ' updates\n';
  
  v_result := v_result || '\n📊 CLEANUP SUMMARY:\n';
  v_result := v_result || '• Total records cleared: ' || v_total_cleared || '\n';
  v_result := v_result || '• ✅ Customer accounts: PRESERVED\n';
  v_result := v_result || '• ✅ Products: PRESERVED\n';
  v_result := v_result || '• ✅ Business settings: PRESERVED\n';
  v_result := v_result || '• ✅ Email templates: PRESERVED\n';
  v_result := v_result || '• ✅ User accounts: PRESERVED\n';
  v_result := v_result || '\n🎉 YOUR SYSTEM IS NOW PRODUCTION READY!\n';
  v_result := v_result || 'All operational/test data has been cleared while preserving all important configuration and customer data.';
  
  RETURN v_result;
  
END;
$$;