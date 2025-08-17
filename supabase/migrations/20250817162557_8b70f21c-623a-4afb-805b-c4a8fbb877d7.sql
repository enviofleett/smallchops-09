
-- 1) Add the missing column for minutes-based average time and backfill
ALTER TABLE public.delivery_analytics
  ADD COLUMN IF NOT EXISTS average_delivery_time_minutes numeric;

UPDATE public.delivery_analytics
SET average_delivery_time_minutes = COALESCE(average_delivery_time_minutes, average_delivery_time::numeric)
WHERE average_delivery_time_minutes IS NULL;

-- 2) Create a partial unique index so ON CONFLICT (date) works for rows that don't specify driver_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'delivery_analytics'
      AND indexname = 'delivery_analytics_unique_date_null_driver'
  ) THEN
    CREATE UNIQUE INDEX delivery_analytics_unique_date_null_driver
      ON public.delivery_analytics (date)
      WHERE driver_id IS NULL;
  END IF;
END$$;

-- 3) Make the delivery metrics trigger non-blocking so payments never fail due to analytics
CREATE OR REPLACE FUNCTION public.update_delivery_metrics_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only attempt analytics for delivery orders
  IF NEW.order_type = 'delivery' THEN
    BEGIN
      PERFORM public.calculate_delivery_metrics(CURRENT_DATE);
    EXCEPTION WHEN OTHERS THEN
      -- Non-blocking: log and proceed
      INSERT INTO audit_logs (
        action, category, message, user_id, entity_id, old_values, new_values
      ) VALUES (
        'delivery_metrics_calc_failed',
        'Analytics',
        'Non-blocking: delivery metrics calculation failed in trigger: ' || SQLERRM,
        auth.uid(),
        NEW.id,
        NULL,
        jsonb_build_object(
          'order_id', NEW.id,
          'order_status', NEW.status,
          'error_code', SQLSTATE
        )
      );
    END;
  END IF;

  RETURN NEW;
END;
$function$;
