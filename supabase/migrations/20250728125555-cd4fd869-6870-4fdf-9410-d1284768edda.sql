-- Fix function search path security warnings
DROP FUNCTION IF EXISTS cleanup_old_communication_events();
DROP FUNCTION IF EXISTS get_hourly_email_stats(timestamp with time zone, timestamp with time zone);

-- Recreate functions with proper search_path
CREATE OR REPLACE FUNCTION cleanup_old_communication_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete events older than 90 days, except failed ones (keep for analysis)
  DELETE FROM communication_events 
  WHERE created_at < NOW() - INTERVAL '90 days' 
  AND status != 'failed';
  
  -- Delete very old failed events (older than 1 year)
  DELETE FROM communication_events 
  WHERE created_at < NOW() - INTERVAL '1 year' 
  AND status = 'failed';
  
  -- Clean up old email delivery logs (older than 6 months)
  DELETE FROM email_delivery_logs 
  WHERE created_at < NOW() - INTERVAL '6 months';
  
  -- Log cleanup operation
  INSERT INTO audit_logs (action, category, message) 
  VALUES ('cleanup_communication_data', 'System Maintenance', 'Cleaned up old communication events and delivery logs');
END;
$$;

-- Recreate monitoring function with proper search_path
CREATE OR REPLACE FUNCTION get_hourly_email_stats(start_time timestamp with time zone, end_time timestamp with time zone)
RETURNS TABLE(
  hour_bucket timestamp with time zone,
  total_sent integer,
  successful_delivered integer,
  failed_attempts integer,
  bounce_rate numeric,
  delivery_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    date_trunc('hour', ce.sent_at) as hour_bucket,
    COUNT(*)::integer as total_sent,
    COUNT(*) FILTER (WHERE edl.status = 'delivered')::integer as successful_delivered,
    COUNT(*) FILTER (WHERE ce.status = 'failed' OR edl.status IN ('bounced', 'complained'))::integer as failed_attempts,
    ROUND(
      (COUNT(*) FILTER (WHERE edl.status IN ('bounced', 'complained'))::numeric / NULLIF(COUNT(*), 0)) * 100, 
      2
    ) as bounce_rate,
    ROUND(
      (COUNT(*) FILTER (WHERE edl.status = 'delivered')::numeric / NULLIF(COUNT(*), 0)) * 100, 
      2
    ) as delivery_rate
  FROM communication_events ce
  LEFT JOIN email_delivery_logs edl ON ce.external_id = edl.email_id
  WHERE ce.sent_at BETWEEN start_time AND end_time
  AND ce.status != 'queued'
  GROUP BY date_trunc('hour', ce.sent_at)
  ORDER BY hour_bucket;
END;
$$;