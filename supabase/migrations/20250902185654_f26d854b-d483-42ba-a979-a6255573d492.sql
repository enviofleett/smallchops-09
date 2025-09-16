-- =============================================================================
-- Fix trigger_order_emails to use idempotent RPC for payment_confirmation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trigger_order_emails()
RETURNS TRIGGER AS $$
DECLARE
  confirmation_result RECORD;
BEGIN
  -- Only handle order_confirmation on INSERT and order_status_update on status change
  
  IF TG_OP = 'INSERT' THEN
    -- Order confirmation email on new orders
    INSERT INTO communication_events (
      event_type,
      recipient_email,
      reference,
      order_id,
      template_variables,
      status,
      created_at
    )
    VALUES (
      'order_confirmation',
      NEW.customer_email,
      NEW.order_number,
      NEW.id,
      jsonb_build_object(
        'customerName', NEW.customer_name,
        'orderNumber', NEW.order_number,
        'orderDate', NEW.created_at::text,
        'totalAmount', NEW.total_amount::text
      ),
      'pending',
      NOW()
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Order status update email on status changes (excluding payment status)
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status != OLD.status THEN
      INSERT INTO communication_events (
        event_type,
        recipient_email,
        reference,
        order_id,
        template_variables,
        status,
        created_at
      )
      VALUES (
        'order_status_update',
        NEW.customer_email,
        NEW.order_number,
        NEW.id,
        jsonb_build_object(
          'customerName', NEW.customer_name,
          'orderNumber', NEW.order_number,
          'oldStatus', OLD.status,
          'newStatus', NEW.status,
          'statusDate', NOW()::text
        ),
        'pending',
        NOW()
      );
    END IF;
    
    -- Payment confirmation using idempotent RPC when payment_status changes to completed/confirmed
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status AND
       NEW.payment_status IN ('completed', 'confirmed') AND
       NEW.payment_reference IS NOT NULL THEN
      
      -- Log the trigger activation
      RAISE NOTICE 'Trigger: Payment status changed from % to % for order %', 
        OLD.payment_status, NEW.payment_status, NEW.order_number;
      
      -- Use idempotent RPC to prevent duplicate key violations
      SELECT * INTO confirmation_result FROM public.upsert_payment_confirmation_event(
        p_reference := NEW.payment_reference,
        p_recipient_email := NEW.customer_email,
        p_order_id := NEW.id,
        p_template_variables := jsonb_build_object(
          'customerName', NEW.customer_name,
          'orderNumber', NEW.order_number,
          'amount', NEW.total_amount::text,
          'paymentMethod', COALESCE(NEW.payment_method, 'Online Payment'),
          'paymentReference', NEW.payment_reference,
          'confirmationDate', NOW()::text
        )
      );
      
      -- Log the result for debugging
      RAISE NOTICE 'Trigger: Payment confirmation RPC result - success: %, message: %, event_id: %', 
        confirmation_result.success, confirmation_result.message, confirmation_result.event_id;
      
      -- Don't fail the transaction even if RPC fails - idempotent behavior
      IF confirmation_result.success = false THEN
        RAISE NOTICE 'Trigger: Payment confirmation RPC failed but continuing transaction: %', 
          confirmation_result.message;
      END IF;
      
    END IF;
    
  END IF;
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;