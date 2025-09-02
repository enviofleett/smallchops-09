-- Guard the payment confirmation trigger to only insert when customer_email is not null
-- This prevents invalid communication events from being created

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS trigger_payment_confirmation_email ON orders;

-- Recreate the trigger function with email validation
CREATE OR REPLACE FUNCTION public.trigger_payment_confirmation_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only proceed if payment status changed to 'paid' and customer_email is valid
  IF TG_OP = 'UPDATE'
     AND OLD.payment_status IS DISTINCT FROM NEW.payment_status
     AND NEW.payment_status = 'paid'
     AND NEW.customer_email IS NOT NULL
     AND LENGTH(TRIM(NEW.customer_email)) > 0
     AND NEW.customer_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    
    -- Only insert if no payment confirmation event already exists for this order
    IF NOT EXISTS (
      SELECT 1 FROM communication_events 
      WHERE order_id = NEW.id 
        AND event_type = 'payment_confirmation' 
        AND template_key = 'payment_confirmation'
    ) THEN
      INSERT INTO public.communication_events (
        order_id,
        event_type,
        recipient_email,
        template_key,
        email_type,
        status,
        variables,
        created_at
      ) VALUES (
        NEW.id,
        'payment_confirmation',
        TRIM(LOWER(NEW.customer_email)),  -- Normalize email
        'payment_confirmation',
        'transactional',
        'queued',
        jsonb_build_object(
          'customerName', COALESCE(NEW.customer_name, 'Valued Customer'),
          'orderNumber', NEW.order_number,
          'amount', NEW.total_amount::text,
          'paymentMethod', COALESCE(NEW.payment_method, 'Online Payment')
        ),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER trigger_payment_confirmation_email
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_payment_confirmation_email();