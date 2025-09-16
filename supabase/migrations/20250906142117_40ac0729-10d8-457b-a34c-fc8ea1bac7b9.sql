
-- Fix: Use the correct pickup_points column (contact_phone) when status becomes 'ready'
CREATE OR REPLACE FUNCTION public.trigger_order_ready_notification()
RETURNS trigger
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
        contact_phone,        -- ← corrected column name
        business_hours
      INTO v_pickup_name, v_pickup_address, v_pickup_phone, v_pickup_hours
      FROM pickup_points
      WHERE id = NEW.pickup_point_id
      LIMIT 1;
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
          COALESCE(NEW.delivery_address->>'instructions', NULL)
          ELSE NULL END,
        'pickupPoint', CASE WHEN NEW.order_type = 'pickup' THEN v_pickup_name ELSE NULL END,
        'pickupAddress', CASE WHEN NEW.order_type = 'pickup' THEN v_pickup_address ELSE NULL END,
        'pickupPhone', CASE WHEN NEW.order_type = 'pickup' THEN v_pickup_phone ELSE NULL END,
        'pickupHours', CASE WHEN NEW.order_type = 'pickup' THEN v_pickup_hours ELSE NULL END,
        'adminEmail', v_admin_email,
        'supportPhone', v_support_phone
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$function$;
