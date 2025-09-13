-- Fix order status validation to allow confirmed -> ready transition for pickup orders and admin flexibility
-- This resolves the 500 error in admin-orders-manager edge function

CREATE OR REPLACE FUNCTION public.validate_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  allowed jsonb := '{
    "pending": ["confirmed","cancelled","refunded","failed"],
    "confirmed": ["preparing","ready","cancelled","refunded"],
    "preparing": ["ready","cancelled"],
    "ready": ["out_for_delivery","delivered","cancelled"],
    "out_for_delivery": ["delivered","completed","cancelled"],
    "delivered": ["completed","refunded"],
    "completed": ["refunded"],
    "failed": ["pending","cancelled"]
  }';
  old_status text;
  new_status text;
  is_admin_update boolean := false;
  is_pickup_order boolean := false;
BEGIN
  old_status := COALESCE(OLD.status::text, '');
  new_status := COALESCE(NEW.status::text, old_status);
  
  -- Check if this is a pickup order
  is_pickup_order := (NEW.order_type = 'pickup');
  
  -- Check if this is an admin-initiated update (by checking if current user is admin)
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = 'admin'::user_role 
      AND is_active = true
  ) INTO is_admin_update;

  -- Only validate status transitions if status actually changed
  IF old_status IS DISTINCT FROM new_status THEN
    -- Standard validation check
    IF NOT (allowed ? old_status) OR NOT ((allowed->old_status) ? new_status) THEN
      RAISE EXCEPTION 'Invalid order status transition: % -> %', old_status, new_status;
    END IF;
    
    -- Log admin status overrides for audit purposes
    IF is_admin_update AND old_status = 'confirmed' AND new_status = 'ready' THEN
      INSERT INTO public.audit_logs (
        action,
        category,
        message,
        user_id,
        entity_id,
        old_values,
        new_values
      ) VALUES (
        'admin_status_override',
        'Order Management',
        'Admin directly transitioned order from confirmed to ready',
        auth.uid(),
        NEW.id,
        jsonb_build_object('old_status', old_status, 'order_type', NEW.order_type),
        jsonb_build_object('new_status', new_status, 'is_pickup', is_pickup_order)
      );
    END IF;
  END IF;

  -- Only require rider assignment for active delivery statuses (not pickup orders)
  IF new_status IN ('out_for_delivery','delivered','completed') 
     AND new_status != 'cancelled'
     AND NEW.order_type = 'delivery' THEN
    IF NEW.assigned_rider_id IS NULL THEN
      RAISE EXCEPTION 'A dispatch rider must be assigned before moving delivery order to %', new_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;