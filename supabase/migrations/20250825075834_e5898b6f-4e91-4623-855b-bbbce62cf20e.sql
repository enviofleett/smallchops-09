
-- Fix: Make order-ready notification trigger null-safe for delivery orders
-- Goal: Prevent "record 'pickup_info' is not assigned yet" error on status update

CREATE OR REPLACE FUNCTION public.trigger_order_ready_notification()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  -- pickup details (nullable)
  v_pickup_name text;
  v_pickup_address text;
  v_pickup_phone text;
  v_pickup_hours jsonb;

  -- business info (nullable)
  v_admin_email text;
  v_support_phone text;
BEGIN
  -- Only trigger when status changes to 'ready'
  IF TG_OP = 'UPDATE' 
     AND OLD.status IS DISTINCT FROM NEW.status 
     AND NEW.status = 'ready' THEN
    
    -- Business contact info (best-effort)
    SELECT 
      admin_notification_email,
      whatsapp_support_number
    INTO v_admin_email, v_support_phone
    FROM business_settings
    ORDER BY created_at ASC
    LIMIT 1;

    -- Initialize pickup vars as NULL defaults (prevents unassigned record errors)
    v_pickup_name := NULL;
    v_pickup_address := NULL;
    v_pickup_phone := NULL;
    v_pickup_hours := NULL;

    -- Populate pickup info only for pickup orders with a valid pickup point
    IF NEW.order_type = 'pickup' AND NEW.pickup_point_id IS NOT NULL THEN
      SELECT 
        name,
        address,
        phone,
        business_hours
      INTO v_pickup_name, v_pickup_address, v_pickup_phone, v_pickup_hours
      FROM pickup_points 
      WHERE id = NEW.pickup_point_id;
    END IF;
    
    -- Queue order ready notification (variables handle NULLs safely)
    INSERT INTO communication_events (
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
      'order_ready',
      NEW.customer_email,
      'order_ready',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', NEW.customer_name,
        'orderNumber', NEW.order_number,
        'orderType', NEW.order_type,
        'orderDate', NEW.order_time::text,
        'totalAmount', NEW.total_amount::text,
        'deliveryAddress', CASE WHEN NEW.order_type = 'delivery' THEN 
          COALESCE(NEW.delivery_address->>'formatted_address', NEW.delivery_address::text) 
          ELSE NULL END,
        'deliveryInstructions', CASE WHEN NEW.order_type = 'delivery' THEN 
          NEW.delivery_address->>'instructions'
          ELSE NULL END,
        'pickupName', v_pickup_name,
        'pickupAddress', v_pickup_address,
        'pickupHours', v_pickup_hours,
        'pickupPhone', v_pickup_phone,
        'supportPhone', v_support_phone
      ),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$function$;
