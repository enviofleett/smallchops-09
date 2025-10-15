-- Fix out_for_delivery template key mapping
-- Previously mapped to 'shipping_notification', should be 'out_for_delivery'

CREATE OR REPLACE FUNCTION public.trigger_order_status_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_template_key TEXT;
  v_dedupe_key TEXT;
  v_recent_event_count INT;
BEGIN
  -- Only send notifications for status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Determine template key (ALL statuses mapped correctly, no NULL)
    v_template_key := CASE 
      WHEN NEW.status = 'out_for_delivery' THEN 'out_for_delivery'  -- ✅ FIXED: was 'shipping_notification'
      WHEN NEW.status = 'delivered' THEN 'order_delivered'
      WHEN NEW.status = 'confirmed' THEN 'order_confirmed'
      WHEN NEW.status = 'preparing' THEN 'order_preparing'
      WHEN NEW.status = 'ready' THEN 'order_ready'
      WHEN NEW.status = 'cancelled' THEN 'order_cancelled'
      ELSE 'order_status_update'  -- Fallback for any other status
    END;
    
    -- Generate deduplication key
    v_dedupe_key := format('order_status:%s:%s:%s', NEW.customer_email, NEW.id, NEW.status);
    
    -- Check for recent duplicate (within last 6 hours)
    SELECT COUNT(*) INTO v_recent_event_count
    FROM communication_events
    WHERE dedupe_key = v_dedupe_key
      AND created_at > NOW() - INTERVAL '6 hours';
    
    -- Only insert if no recent duplicate
    IF v_recent_event_count = 0 THEN
      INSERT INTO communication_events (
        event_type,
        recipient_email,
        order_id,
        template_key,
        dedupe_key,
        variables,
        priority,
        status
      ) VALUES (
        'order_status_update',
        NEW.customer_email,
        NEW.id,
        v_template_key,
        v_dedupe_key,
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
    ELSE
      RAISE NOTICE 'Skipped duplicate email: % for order % (status: %)', 
        NEW.customer_email, NEW.order_number, NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Clean up any remaining NULL template_key events
UPDATE communication_events
SET status = 'failed',
    error_message = 'Invalid template_key: NULL - fixed in out_for_delivery template migration',
    updated_at = NOW()
WHERE template_key IS NULL
  AND status IN ('queued', 'processing');