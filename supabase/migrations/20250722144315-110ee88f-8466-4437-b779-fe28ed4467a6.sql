-- Fix security warnings: Set proper search_path for functions

-- Fix get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(user_id_to_check UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER 
SET search_path = 'public'
AS $$
    SELECT role::TEXT FROM profiles WHERE id = user_id_to_check;
$$;

-- Fix is_admin function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid();
$$;

-- Fix queue_order_status_change_communication function
CREATE OR REPLACE FUNCTION public.queue_order_status_change_communication()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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