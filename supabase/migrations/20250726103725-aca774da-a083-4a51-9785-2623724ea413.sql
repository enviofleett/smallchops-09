-- Fix security issue: Set search_path for the track_price_changes function
CREATE OR REPLACE FUNCTION public.track_price_changes()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  -- Only track if price actually changed
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO public.product_price_history (product_id, old_price, new_price, changed_by)
    VALUES (NEW.id, OLD.price, NEW.price, auth.uid());
    
    -- Queue price change notifications for customers who have this product in favorites
    INSERT INTO public.notification_queue (customer_id, product_id, notification_type, data)
    SELECT 
      cf.customer_id, 
      NEW.id, 
      'price_change',
      jsonb_build_object(
        'old_price', OLD.price,
        'new_price', NEW.price,
        'product_name', NEW.name,
        'percentage_change', ROUND(((NEW.price - OLD.price) / OLD.price * 100)::numeric, 2)
      )
    FROM public.customer_favorites cf
    INNER JOIN public.customer_notification_preferences cnp ON cf.customer_id = cnp.customer_id
    WHERE cf.product_id = NEW.id 
    AND cnp.price_alerts = true
    AND ABS((NEW.price - OLD.price) / OLD.price * 100) >= cnp.minimum_discount_percentage;
  END IF;
  
  RETURN NEW;
END;
$$;