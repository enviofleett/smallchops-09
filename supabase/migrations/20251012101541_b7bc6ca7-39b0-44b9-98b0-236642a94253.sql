-- Drop problematic trigger and function causing payment failures
DROP TRIGGER IF EXISTS trigger_log_order_status_change ON public.orders;
DROP FUNCTION IF EXISTS public.log_order_status_change();

-- Drop the order_status_history table
DROP TABLE IF EXISTS public.order_status_history;