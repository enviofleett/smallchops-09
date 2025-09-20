-- Enhanced cache cleanup function for stuck entries
CREATE OR REPLACE FUNCTION public.cleanup_stuck_request_cache(p_minutes_threshold integer DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  expired_count integer := 0;
  stuck_count integer := 0;
  total_cleaned integer := 0;
BEGIN
  -- Clean up expired cache entries (older than threshold)
  DELETE FROM request_cache 
  WHERE created_at < now() - (p_minutes_threshold || ' minutes')::interval
    AND status IN ('processing', 'failed');
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  -- Clean up stuck processing entries (older than 2 minutes regardless of threshold)
  DELETE FROM request_cache 
  WHERE created_at < now() - interval '2 minutes'
    AND status = 'processing';
  
  GET DIAGNOSTICS stuck_count = ROW_COUNT;
  
  total_cleaned := expired_count + stuck_count;
  
  -- Log cleanup activity
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'stuck_cache_cleanup_enhanced',
    'Cache Management',
    'Enhanced cleanup of stuck cache entries',
    jsonb_build_object(
      'expired_cleaned', expired_count,
      'stuck_cleaned', stuck_count,
      'total_cleaned', total_cleaned,
      'threshold_minutes', p_minutes_threshold
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'expired_cleaned', expired_count,
    'stuck_cleaned', stuck_count,
    'total_cleaned', total_cleaned
  );
END;
$function$;

-- Function to force clear cache for specific order
CREATE OR REPLACE FUNCTION public.force_clear_order_cache(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  cleared_count integer := 0;
BEGIN
  -- Delete all cache entries for this specific order
  DELETE FROM request_cache 
  WHERE request_data->>'orderId' = p_order_id::text
     OR request_data->>'order_id' = p_order_id::text;
  
  GET DIAGNOSTICS cleared_count = ROW_COUNT;
  
  -- Log the forced cleanup
  INSERT INTO audit_logs (action, category, message, entity_id, new_values)
  VALUES (
    'force_clear_order_cache',
    'Cache Management',
    'Force cleared all cache entries for order',
    p_order_id,
    jsonb_build_object(
      'entries_cleared', cleared_count,
      'forced_by', auth.uid()
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'entries_cleared', cleared_count,
    'order_id', p_order_id
  );
END;
$function$;