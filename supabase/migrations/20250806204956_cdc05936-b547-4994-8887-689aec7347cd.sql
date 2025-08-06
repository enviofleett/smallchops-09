-- Fix the trigger function to only use columns that exist in orders table
CREATE OR REPLACE FUNCTION public.trigger_order_status_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only send notifications for status changes (not inserts)
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO communication_events (
      event_type,
      recipient_email,
      order_id,
      template_key,
      variables,
      priority,
      status
    ) VALUES (
      'order_status_update',
      NEW.customer_email,
      NEW.id,
      CASE 
        WHEN NEW.status = 'out_for_delivery' THEN 'shipping_notification'
        WHEN NEW.status = 'delivered' THEN 'order_delivered'
        WHEN NEW.status = 'confirmed' THEN 'order_confirmed'
        ELSE 'order_status_update'
      END,
      jsonb_build_object(
        'customer_name', NEW.customer_name,
        'order_id', NEW.id::text,
        'order_number', NEW.order_number,
        'status', NEW.status,
        'status_message', 
          CASE NEW.status
            WHEN 'confirmed' THEN 'Your order has been confirmed'
            WHEN 'preparing' THEN 'Your order is being prepared'
            WHEN 'ready' THEN 'Your order is ready for pickup/delivery'
            WHEN 'out_for_delivery' THEN 'Your order is on its way!'
            WHEN 'delivered' THEN 'Your order has been delivered'
            WHEN 'completed' THEN 'Your order is complete'
            WHEN 'cancelled' THEN 'Your order has been cancelled'
            ELSE 'Order status updated'
          END
      ),
      CASE 
        WHEN NEW.status IN ('confirmed', 'out_for_delivery', 'delivered') THEN 'high'
        ELSE 'normal'
      END,
      'queued'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Now update existing orders with paid status to confirmed
UPDATE orders 
SET 
  status = 'confirmed',
  updated_at = NOW()
WHERE payment_status = 'paid' 
AND status = 'pending';