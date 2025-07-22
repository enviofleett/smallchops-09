
-- Phase 1: Database Triggers and Event System

-- 1. Create a new ENUM type for communication event statuses
CREATE TYPE public.communication_event_status AS ENUM (
  'queued',
  'processing',
  'sent',
  'failed'
);

-- 2. Create the table to queue communication events
CREATE TABLE public.communication_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- e.g., 'order_status_update'
  payload JSONB,
  status public.communication_event_status NOT NULL DEFAULT 'queued',
  retry_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comments to the columns for clarity
COMMENT ON COLUMN public.communication_events.event_type IS 'The type of event that triggered this communication, e.g., ''order_status_update''.';
COMMENT ON COLUMN public.communication_events.payload IS 'Data related to the event, like old and new status, customer details, etc.';
COMMENT ON COLUMN public.communication_events.status IS 'The processing status of this communication event.';
COMMENT ON COLUMN public.communication_events.retry_count IS 'How many times processing has been attempted for this event.';
COMMENT ON COLUMN public.communication_events.last_error IS 'The error message from the last failed processing attempt.';

-- Add an index on status for faster querying of queued items
CREATE INDEX idx_communication_events_status ON public.communication_events (status);

-- Enable RLS for the new table.
ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;

-- Admins and managers can view the queue for debugging/monitoring
CREATE POLICY "Admins and managers can view communication events"
ON public.communication_events FOR SELECT
USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

-- Service roles can process the queue (will be used by Edge Functions)
CREATE POLICY "Service roles can manage communication events"
ON public.communication_events FOR ALL
USING (auth.role() = 'service_role');


-- 3. Create a trigger function to populate the queue on order status change
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
        'customer_phone', NEW.customer_phone
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Create the trigger on the orders table
-- Drop trigger if it exists to ensure idempotency
DROP TRIGGER IF EXISTS on_order_status_update ON public.orders;
CREATE TRIGGER on_order_status_update
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.queue_order_status_change_communication();

-- 5. Create a trigger to automatically update the 'updated_at' timestamp on the events table
-- Drop trigger if it exists to ensure idempotency
DROP TRIGGER IF EXISTS handle_updated_at_communication_events ON public.communication_events;
CREATE TRIGGER handle_updated_at_communication_events
BEFORE UPDATE ON public.communication_events
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

