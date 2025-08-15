-- PHASE 1: CRITICAL SECURITY FIXES FOR PRODUCTION LAUNCH (FINAL FIX)
-- Enable RLS on backup tables and secure functions

-- Enable RLS on backup tables (these are actual tables)
ALTER TABLE public.delivery_zones_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_fees_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone_consolidation_map ENABLE ROW LEVEL SECURITY;

-- Create admin-only access policies for backup tables
CREATE POLICY "Admin only access to delivery zones backup" ON public.delivery_zones_backup
  FOR ALL USING (is_admin());

CREATE POLICY "Admin only access to delivery fees backup" ON public.delivery_fees_backup
  FOR ALL USING (is_admin());

CREATE POLICY "Admin only access to zone consolidation map" ON public.zone_consolidation_map
  FOR ALL USING (is_admin());

-- Drop and recreate function with proper signature
DROP FUNCTION IF EXISTS public.calculate_delivery_metrics(date);

CREATE FUNCTION public.calculate_delivery_metrics(p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO delivery_analytics (
    date,
    total_deliveries,
    completed_deliveries,
    failed_deliveries,
    total_delivery_fees,
    average_delivery_time_minutes
  )
  SELECT 
    p_date,
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'delivered') as completed_deliveries,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_deliveries,
    COALESCE(SUM(delivery_fee), 0) as total_delivery_fees,
    AVG(EXTRACT(EPOCH FROM (delivered_at - created_at))/60) FILTER (WHERE delivered_at IS NOT NULL) as avg_time
  FROM orders 
  WHERE DATE(created_at) = p_date
  AND order_type = 'delivery'
  ON CONFLICT (date) DO UPDATE SET
    total_deliveries = EXCLUDED.total_deliveries,
    completed_deliveries = EXCLUDED.completed_deliveries,
    failed_deliveries = EXCLUDED.failed_deliveries,
    total_delivery_fees = EXCLUDED.total_delivery_fees,
    average_delivery_time_minutes = EXCLUDED.average_delivery_time_minutes,
    updated_at = NOW();
END;
$function$;