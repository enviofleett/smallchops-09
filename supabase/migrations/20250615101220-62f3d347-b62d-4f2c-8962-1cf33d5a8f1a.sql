
-- Step 1: Add the customer_email column to the orders table
ALTER TABLE public.orders
ADD COLUMN customer_email TEXT;

COMMENT ON COLUMN public.orders.customer_email IS 'The email address of the customer for sending notifications.';

-- Step 2: Update the trigger function to include customer_email in the event payload
CREATE OR REPLACE FUNCTION public.queue_order_status_change_communication()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert an event into the queue only when the order status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.communication_events (order_id, event_type, payload)
    VALUES (
      NEW.id,
      'order_status_update',
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'customer_name', NEW.customer_name,
        'customer_phone', NEW.customer_phone,
        'customer_email', NEW.customer_email
      )
    );
  END IF;
  RETURN NEW;
END;
$$;
