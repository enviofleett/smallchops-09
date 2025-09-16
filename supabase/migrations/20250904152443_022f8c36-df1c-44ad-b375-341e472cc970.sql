-- FINAL PRODUCTION CLEANUP with proper FK handling
CREATE OR REPLACE FUNCTION public.production_cleanup()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result text := '🚀 PRODUCTION GO-LIVE CLEANUP\n\n';
  v_count int;
  v_total_cleared int := 0;
  v_table_name text;
  v_operational_tables text[] := ARRAY[
    'payment_processing_logs',
    'payment_error_logs', 
    'payment_verification_logs',
    'payment_audit_log',
    'order_status_changes',
    'order_delivery_schedule',
    'order_assignments',
    'order_items',
    'order_audit_log',
    'communication_events',
    'communication_events_archive', 
    'communication_logs',
    'cart_sessions',
    'cart_abandonment_tracking',
    'business_analytics',
    'api_metrics',
    'api_request_logs',
    'cron_execution_logs',
    'automation_activity_logs',
    'smtp_delivery_logs',
    'smtp_delivery_confirmations',
    'orders'
  ];
BEGIN
  -- Clear each operational table if it exists
  FOREACH v_table_name IN ARRAY v_operational_tables
  LOOP
    BEGIN
      EXECUTE format('SELECT COUNT(*) FROM %I', v_table_name) INTO v_count;
      IF v_count > 0 THEN
        EXECUTE format('DELETE FROM %I', v_table_name);
        v_result := v_result || '✓ ' || v_table_name || ': ' || v_count || ' records cleared\n';
        v_total_cleared := v_total_cleared + v_count;
      END IF;
    EXCEPTION 
      WHEN undefined_table THEN
        -- Table doesn't exist, skip
        NULL;
      WHEN OTHERS THEN
        v_result := v_result || '⚠ ' || v_table_name || ': ' || SQLERRM || '\n';
    END;
  END LOOP;
  
  -- Clear customer order references
  BEGIN
    UPDATE customer_accounts SET last_order_date = NULL WHERE last_order_date IS NOT NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_result := v_result || '✓ Customer order references: ' || v_count || ' cleared\n';
  EXCEPTION WHEN OTHERS THEN
    v_result := v_result || '⚠ Customer references: ' || SQLERRM || '\n';
  END;
  
  v_result := v_result || '\n📊 SUMMARY:\n';
  v_result := v_result || '• Total operational records cleared: ' || v_total_cleared || '\n';
  v_result := v_result || '• ✅ PRESERVED: Customer accounts, products, business settings\n';
  v_result := v_result || '• ✅ PRESERVED: Email templates and configurations\n';
  v_result := v_result || '• ✅ PRESERVED: User accounts and permissions\n';
  v_result := v_result || '\n🎉 PRODUCTION GO-LIVE SUCCESSFUL!\n';
  v_result := v_result || 'Your system is now ready for production use with a clean slate.';
  
  RETURN v_result;
  
END;
$$;