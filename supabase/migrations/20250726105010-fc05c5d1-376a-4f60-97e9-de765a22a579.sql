-- Fix function search path security warning
CREATE OR REPLACE FUNCTION public.update_customer_analytics()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
BEGIN
  -- Update or insert customer analytics when order status changes to completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO public.customer_purchase_analytics (
      customer_email,
      total_orders,
      total_spent,
      average_order_value,
      last_purchase_date
    )
    SELECT 
      NEW.customer_email,
      COUNT(*),
      SUM(total_amount),
      AVG(total_amount),
      MAX(order_time)
    FROM public.orders 
    WHERE customer_email = NEW.customer_email 
    AND status = 'completed'
    ON CONFLICT (customer_email) 
    DO UPDATE SET
      total_orders = EXCLUDED.total_orders,
      total_spent = EXCLUDED.total_spent,
      average_order_value = EXCLUDED.average_order_value,
      last_purchase_date = EXCLUDED.last_purchase_date,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;