-- Migration to fix excessive email issues
-- 1. Create RPC for atomic event claiming (fixes race condition)
-- 2. Drop duplicate trigger (fixes double queuing)
-- 3. Fix upsert_communication_event to respect dedupe_key (fixes multiple inserts)
-- 4. Update log_order_status_change_with_email to use deterministic keys

-- 1. RPC for atomic claiming (SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.fetch_and_lock_communication_events(p_limit integer DEFAULT 20)
RETURNS SETOF public.communication_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    WITH locked_events AS (
        SELECT id
        FROM public.communication_events
        WHERE status = 'queued'
        AND template_key IS NOT NULL
        ORDER BY created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.communication_events
    SET status = 'processing',
        updated_at = now()
    FROM locked_events
    WHERE public.communication_events.id = locked_events.id
    RETURNING public.communication_events.*;
END;
$$;

-- 2. Drop duplicate trigger and function
-- This trigger was inserting events directly without checking existing queue, causing duplicates
DROP TRIGGER IF EXISTS on_order_status_update ON public.orders;
DROP FUNCTION IF EXISTS public.queue_order_status_change_communication();

-- 3. Fix upsert_communication_event to respect dedupe_key
-- Previously it appended random suffix even if key was provided, defeating deduplication
CREATE OR REPLACE FUNCTION public.upsert_communication_event(
    p_event_type text,
    p_recipient_email text,
    p_recipient_name text,
    p_template_key text,
    p_template_variables jsonb,
    p_related_order_id uuid,
    p_dedupe_key text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    event_id UUID;
    calculated_dedupe_key TEXT;
    unique_suffix TEXT;
BEGIN
    IF p_dedupe_key IS NULL THEN
        -- Generate unique key if not provided (fallback to allow duplicates if no key)
        unique_suffix := gen_random_uuid()::text || '_' || 
                       EXTRACT(EPOCH FROM clock_timestamp())::bigint::text;
        calculated_dedupe_key := p_related_order_id::TEXT || '|' || 
                       p_event_type || '|' || 
                       COALESCE(p_template_key, 'no-template') || '|' || 
                       p_recipient_email || '|' || 
                       unique_suffix;
    ELSE
        -- Use provided key strictly for deduplication
        calculated_dedupe_key := p_dedupe_key;
    END IF;

    -- Try to insert or update if exists (idempotent)
    -- Requires unique constraint on dedupe_key
    BEGIN
        INSERT INTO communication_events (
            event_type, recipient_email, template_key, template_variables,
            status, dedupe_key, order_id, created_at, updated_at
        ) VALUES (
            p_event_type, p_recipient_email, p_template_key, p_template_variables,
            'queued', calculated_dedupe_key, p_related_order_id, now(), now()
        )
        ON CONFLICT (dedupe_key) DO UPDATE SET
            template_variables = EXCLUDED.template_variables,
            updated_at = now(),
            -- Only reset status to queued if it was failed. 
            -- If it's sent, we don't re-send.
            status = CASE 
                WHEN communication_events.status = 'failed' THEN 'queued'
                ELSE communication_events.status
            END
        RETURNING id INTO event_id;
    EXCEPTION 
        WHEN undefined_object THEN
             -- In case constraint is missing (should not happen if migration order is correct)
             -- Fallback to simple insert which might fail or duplicate
             INSERT INTO communication_events (
                event_type, recipient_email, template_key, template_variables,
                status, dedupe_key, order_id, created_at, updated_at
            ) VALUES (
                p_event_type, p_recipient_email, p_template_key, p_template_variables,
                'queued', calculated_dedupe_key, p_related_order_id, now(), now()
            )
            RETURNING id INTO event_id;
    END;

    RETURN event_id;
END;
$function$;

-- 4. Update log_order_status_change_with_email to use deterministic dedupe key
-- Removed the timestamp from the dedupe key generation
CREATE OR REPLACE FUNCTION public.log_order_status_change_with_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    event_id UUID;
BEGIN
    -- Log status changes and trigger emails
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Log the status change
        INSERT INTO audit_logs (
            action, category, message, user_id, entity_id, old_values, new_values
        ) VALUES (
            'order_status_changed',
            'Order Management', 
            'Order status changed from ' || COALESCE(OLD.status, 'null') || ' to ' || NEW.status,
            auth.uid(),
            NEW.id,
            jsonb_build_object('old_status', OLD.status),
            jsonb_build_object('new_status', NEW.status, 'order_number', NEW.order_number)
        );
        
        -- Queue customer notification email for important status changes
        IF NEW.status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') 
           AND NEW.customer_email IS NOT NULL THEN
          
            SELECT upsert_communication_event(
                'order_status_update',
                NEW.customer_email,
                COALESCE(NEW.customer_name, 'Customer'),
                'order_status_' || NEW.status,
                jsonb_build_object(
                    'customer_name', COALESCE(NEW.customer_name, 'Customer'),
                    'order_number', NEW.order_number,
                    'status', NEW.status,
                    'order_total', NEW.total_amount,
                    'delivery_address', NEW.delivery_address
                ),
                NEW.id,
                -- Deterministic dedupe key: OrderID + Status (No timestamp)
                NEW.id::text || '_status_' || NEW.status
            ) INTO event_id;
            
            IF event_id IS NOT NULL THEN
                INSERT INTO audit_logs (
                    action, category, message, entity_id, new_values
                ) VALUES (
                    'email_queued_status_change',
                    'Communication',
                    'Email queued for order status change: ' || NEW.status,
                    NEW.id,
                    jsonb_build_object('email_event_id', event_id, 'status', NEW.status)
                );
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;
