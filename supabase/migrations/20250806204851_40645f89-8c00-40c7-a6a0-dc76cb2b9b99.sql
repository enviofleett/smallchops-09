-- Drop all triggers on orders table to fix the enum issue
DROP TRIGGER IF EXISTS trigger_order_status_email ON orders;
DROP TRIGGER IF EXISTS trigger_order_emails ON orders;
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;

-- Create a fixed trigger function that uses correct enum values
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
          END,
        'tracking_number', COALESCE(NEW.tracking_number, ''),
        'estimated_delivery', COALESCE(NEW.estimated_delivery_date::text, '')
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

-- Recreate the trigger with the fixed function
CREATE TRIGGER trigger_order_status_email
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_order_status_email();

-- Recreate the updated_at trigger
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();