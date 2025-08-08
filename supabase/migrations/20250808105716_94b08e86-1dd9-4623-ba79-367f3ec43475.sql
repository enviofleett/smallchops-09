
-- Create a focused trigger for payment confirmation emails (avoids duplicating status emails)
CREATE OR REPLACE FUNCTION public.trigger_payment_confirmation_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only when payment_status changes to 'paid'
  IF TG_OP = 'UPDATE'
     AND OLD.payment_status IS DISTINCT FROM NEW.payment_status
     AND NEW.payment_status = 'paid' THEN
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
      NEW.customer_email,
      'payment_confirmation',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', NEW.customer_name,
        'orderNumber', NEW.order_number,
        'amount', NEW.total_amount::text,
        'paymentMethod', COALESCE(NEW.payment_method, 'Online Payment')
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Create (or recreate) the trigger that fires on payment_status change
DROP TRIGGER IF EXISTS trigger_order_payment_email ON public.orders;

CREATE TRIGGER trigger_order_payment_email
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_payment_confirmation_email();
