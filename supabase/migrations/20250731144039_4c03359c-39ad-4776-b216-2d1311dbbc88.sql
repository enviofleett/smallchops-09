-- Phase 1: Fix Database Constraints for User Registration

-- Make order_id nullable in communication_events table since welcome emails 
-- and other user-triggered events don't always have an associated order
ALTER TABLE public.communication_events 
ALTER COLUMN order_id DROP NOT NULL;

-- Update the trigger_customer_welcome_email function to work without order_id
CREATE OR REPLACE FUNCTION public.trigger_customer_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
  business_name TEXT;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email 
  FROM auth.users 
  WHERE id = NEW.user_id;
  
  -- Get business name from settings
  SELECT name INTO business_name 
  FROM business_settings 
  ORDER BY updated_at DESC 
  LIMIT 1;

  -- Send welcome email for new customer accounts (no order_id needed)
  IF user_email IS NOT NULL THEN
    INSERT INTO communication_events (
      event_type,
      recipient_email,
      template_id,
      email_type,
      status,
      variables
    ) VALUES (
      'customer_welcome',
      user_email,
      'customer_welcome',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', NEW.name,
        'businessName', COALESCE(business_name, 'Our Store')
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Update trigger_order_emails function to handle nullable order_id properly
CREATE OR REPLACE FUNCTION public.trigger_order_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Send order confirmation email when order is first created
  IF TG_OP = 'INSERT' THEN
    INSERT INTO communication_events (
      order_id,
      event_type,
      recipient_email,
      template_id,
      email_type,
      status,
      variables
    ) VALUES (
      NEW.id,
      'order_confirmation',
      NEW.customer_email,
      'order_confirmation',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', NEW.customer_name,
        'orderNumber', NEW.order_number,
        'orderTotal', NEW.total_amount::text,
        'orderType', NEW.order_type,
        'deliveryAddress', NEW.delivery_address,
        'pickupAddress', CASE WHEN NEW.order_type = 'pickup' THEN 'Store Location' ELSE NULL END
      )
    );
    RETURN NEW;
  END IF;

  -- Send status update email when order status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO communication_events (
      order_id,
      event_type,
      recipient_email,
      template_id,
      email_type,
      status,
      variables
    ) VALUES (
      NEW.id,
      'order_status_update',
      NEW.customer_email,
      'order_status_update',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', NEW.customer_name,
        'orderNumber', NEW.order_number,
        'newStatus', NEW.status,
        'oldStatus', OLD.status,
        'estimatedTime', CASE 
          WHEN NEW.status = 'confirmed' THEN '30-45 minutes'
          WHEN NEW.status = 'preparing' THEN '20-30 minutes'
          WHEN NEW.status = 'ready' THEN 'Ready for pickup'
          WHEN NEW.status = 'out_for_delivery' THEN '10-15 minutes'
          WHEN NEW.status = 'delivered' THEN 'Completed'
          ELSE NULL
        END
      )
    );
  END IF;

  -- Send payment confirmation email when payment is confirmed
  IF TG_OP = 'UPDATE' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.payment_status = 'paid' THEN
    INSERT INTO communication_events (
      order_id,
      event_type,
      recipient_email,
      template_id,
      email_type,
      status,
      variables
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
      )
    );
  END IF;

  RETURN NEW;
END;
$$;