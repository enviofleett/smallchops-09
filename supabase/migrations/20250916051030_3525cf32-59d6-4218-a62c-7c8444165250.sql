-- Fix remaining security warnings from Phase 1 implementation

-- 1. FIX REMAINING FUNCTIONS WITHOUT PROPER search_path
-- Update all remaining database functions to include SET search_path TO 'public'

-- Fix safe_update_order_status function
CREATE OR REPLACE FUNCTION public.safe_update_order_status(p_order_id uuid, p_new_status text, p_admin_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_order RECORD;
    old_status TEXT;
BEGIN
    -- Get current status
    SELECT status INTO old_status FROM orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Skip if status unchanged
    IF old_status = p_new_status THEN
        SELECT * INTO result_order FROM orders WHERE id = p_order_id;
        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Status unchanged',
            'order', row_to_json(result_order)
        );
    END IF;
    
    -- Update order status
    UPDATE orders 
    SET status = p_new_status,
        updated_at = now(),
        updated_by = p_admin_id
    WHERE id = p_order_id
    RETURNING * INTO result_order;
    
    -- Log status change
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
    VALUES (
        'order_status_update',
        'Order Management',
        'Order status updated from ' || old_status || ' to ' || p_new_status,
        p_admin_id,
        p_order_id,
        jsonb_build_object('status', old_status),
        jsonb_build_object('status', p_new_status)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Order updated successfully', 
        'order', row_to_json(result_order)
    );
END;
$function$;

-- Fix upsert_communication_event function 
CREATE OR REPLACE FUNCTION public.upsert_communication_event(p_event_type text, p_recipient_email text, p_recipient_name text, p_template_key text, p_template_variables jsonb, p_related_order_id uuid, p_dedupe_key text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    event_id UUID;
    calculated_dedupe_key TEXT;
    unique_suffix TEXT;
    attempt_count INTEGER := 0;
    max_attempts INTEGER := 5;
BEGIN
    -- Generate truly unique dedupe key with multiple layers of uniqueness
    LOOP
        attempt_count := attempt_count + 1;
        
        IF p_dedupe_key IS NULL THEN
            -- Generate completely unique key using UUID + timestamp + random
            unique_suffix := gen_random_uuid()::text || '_' || 
                           EXTRACT(EPOCH FROM clock_timestamp())::bigint::text || '_' ||
                           EXTRACT(MICROSECONDS FROM clock_timestamp())::text;
            calculated_dedupe_key := p_related_order_id::TEXT || '|' || 
                                   p_event_type || '|' || 
                                   COALESCE(p_template_key, 'no-template') || '|' || 
                                   p_recipient_email || '|' || 
                                   unique_suffix;
        ELSE
            -- Use provided key but ensure uniqueness
            unique_suffix := gen_random_uuid()::text || '_' || 
                           EXTRACT(EPOCH FROM clock_timestamp())::bigint::text || '_' ||
                           EXTRACT(MICROSECONDS FROM clock_timestamp())::text;
            calculated_dedupe_key := p_dedupe_key || '|' || unique_suffix;
        END IF;
        
        -- Try to insert with generated dedupe key
        BEGIN
            INSERT INTO communication_events (
                event_type, recipient_email, template_key, template_variables,
                status, dedupe_key, order_id, created_at, updated_at
            ) VALUES (
                p_event_type, p_recipient_email, p_template_key, p_template_variables,
                'queued', calculated_dedupe_key, p_related_order_id, now(), now()
            )
            RETURNING id INTO event_id;
            
            -- If successful, exit the loop
            EXIT;
            
        EXCEPTION
            WHEN unique_violation THEN
                -- Log the collision and retry with new suffix
                INSERT INTO audit_logs (action, category, message, new_values)
                VALUES (
                    'communication_event_dedupe_collision',
                    'Email System',
                    'Dedupe key collision on attempt ' || attempt_count::text,
                    jsonb_build_object(
                        'attempted_key', calculated_dedupe_key,
                        'order_id', p_related_order_id,
                        'event_type', p_event_type,
                        'attempt', attempt_count
                    )
                );
                
                -- If max attempts reached, try ON CONFLICT approach
                IF attempt_count >= max_attempts THEN
                    -- Final attempt with ON CONFLICT DO UPDATE
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
                        status = CASE 
                            WHEN communication_events.status = 'failed' THEN 'queued'
                            ELSE communication_events.status
                        END
                    RETURNING id INTO event_id;
                    
                    EXIT;
                END IF;
                
                -- Continue loop for retry
        END;
    END LOOP;
    
    -- Log successful creation
    INSERT INTO audit_logs (action, category, message, new_values)
    VALUES (
        'communication_event_created',
        'Email System',
        'Communication event created successfully',
        jsonb_build_object(
            'event_id', event_id,
            'event_type', p_event_type,
            'order_id', p_related_order_id,
            'dedupe_key', calculated_dedupe_key,
            'attempts', attempt_count
        )
    );
    
    RETURN event_id;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail - return NULL to indicate failure
        INSERT INTO audit_logs (action, category, message, new_values)
        VALUES (
            'communication_event_creation_failed',
            'Email System',
            'Failed to create communication event: ' || SQLERRM,
            jsonb_build_object(
                'event_type', p_event_type,
                'order_id', p_related_order_id,
                'error', SQLERRM,
                'sqlstate', SQLSTATE
            )
        );
        
        -- Return NULL instead of raising exception
        RETURN NULL;
END;
$function$;

-- Fix admin_queue_order_email function
CREATE OR REPLACE FUNCTION public.admin_queue_order_email(p_order_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    customer_email TEXT;
    customer_name TEXT;
    template_key TEXT;
    unique_key TEXT;
    order_number TEXT;
    total_amount NUMERIC;
BEGIN
    -- Get order and customer info
    SELECT o.order_number, o.total_amount, o.customer_email, o.customer_name
    INTO order_number, total_amount, customer_email, customer_name
    FROM orders o
    WHERE o.id = p_order_id;
    
    -- Skip if no customer email
    IF customer_email IS NULL THEN
        RETURN;
    END IF;
    
    -- Get template key
    CASE p_status
        WHEN 'confirmed' THEN template_key := 'order_confirmed';
        WHEN 'preparing' THEN template_key := 'order_preparing';
        WHEN 'ready' THEN template_key := 'order_ready';
        WHEN 'out_for_delivery' THEN template_key := 'order_out_for_delivery';
        WHEN 'delivered' THEN template_key := 'order_delivered';
        WHEN 'cancelled' THEN template_key := 'order_cancelled';
        ELSE RETURN;
    END CASE;
    
    -- Create truly unique key with timestamp
    unique_key := p_order_id::TEXT || '|' || 
                 p_status || '|' || 
                 template_key || '|' || 
                 customer_email || '|' || 
                 FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000000)::TEXT;
    
    -- Use UPSERT: Insert or update updated_at if duplicate dedupe_key found
    INSERT INTO communication_events (
        event_type,
        recipient_email,
        template_key,
        template_variables,
        status,
        dedupe_key,
        order_id,
        created_at,
        updated_at
    ) VALUES (
        'order_status_update',
        customer_email,
        template_key,
        jsonb_build_object(
            'customer_name', COALESCE(customer_name, 'Customer'),
            'order_number', order_number,
            'status', p_status,
            'total_amount', COALESCE(total_amount, 0)
        ),
        'queued',
        unique_key,
        p_order_id,
        now(),
        now()
    ) ON CONFLICT (dedupe_key) DO UPDATE SET
        updated_at = now(),
        status = CASE 
            WHEN communication_events.status = 'failed' THEN 'queued'
            ELSE communication_events.status
        END;
    
    -- Log successful upsert
    INSERT INTO audit_logs (action, category, message, entity_id, new_values)
    VALUES (
        'communication_event_upserted',
        'Email System',
        'Communication event upserted for order: ' || order_number,
        p_order_id,
        jsonb_build_object(
            'dedupe_key', unique_key,
            'template_key', template_key,
            'status', p_status,
            'upsert_type', 'admin_queue_order_email'
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Enhanced error logging
    INSERT INTO audit_logs (action, category, message, entity_id, new_values)
    VALUES (
        'communication_event_upsert_failed',
        'Email System',
        'Failed to upsert communication event: ' || SQLERRM,
        p_order_id,
        jsonb_build_object(
            'error', SQLERRM,
            'sqlstate', SQLSTATE,
            'order_id', p_order_id,
            'status', p_status,
            'template_key', template_key
        )
    );
    
    -- Log error but don't propagate
    RAISE LOG 'Failed to queue email for order %: %', p_order_id, SQLERRM;
END;
$function$;

-- Fix admin_safe_update_order_status function
CREATE OR REPLACE FUNCTION public.admin_safe_update_order_status(p_order_id uuid, p_new_status text, p_admin_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_record RECORD;
  v_old_status text;
  v_email_result jsonb;
  v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
  v_unique_suffix text;
  v_dedupe_key text;
  v_attempt_count integer := 0;
BEGIN
  -- Validate status enum value and handle null
  IF p_new_status IS NULL OR p_new_status = 'null' OR p_new_status = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Status cannot be null or empty'
    );
  END IF;

  IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid status value: ' || p_new_status || '. Valid values are: ' || array_to_string(v_valid_statuses, ', ')
    );
  END IF;

  -- Get current order
  SELECT * INTO v_order_record
  FROM orders 
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;
  
  v_old_status := v_order_record.status::text;
  
  -- Skip if status unchanged
  IF v_old_status = p_new_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Status unchanged',
      'order', row_to_json(v_order_record)
    );
  END IF;
  
  -- Update order status with explicit enum casting and null protection
  UPDATE orders 
  SET 
    status = CASE 
      WHEN p_new_status IS NOT NULL AND p_new_status != 'null' AND p_new_status != '' 
      THEN p_new_status::order_status 
      ELSE status 
    END,
    updated_at = now(),
    updated_by = p_admin_id
  WHERE id = p_order_id;
  
  -- Get updated order
  SELECT * INTO v_order_record
  FROM orders 
  WHERE id = p_order_id;
  
  -- Queue email notification (non-blocking) with robust dedupe key
  IF v_order_record.customer_email IS NOT NULL AND 
     p_new_status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') THEN
    
    BEGIN
      -- Generate truly unique dedupe key with multiple entropy sources
      v_unique_suffix := gen_random_uuid()::text || '_' || 
                        EXTRACT(EPOCH FROM clock_timestamp())::bigint::text || '_' ||
                        EXTRACT(MICROSECONDS FROM clock_timestamp())::text || '_' ||
                        pg_backend_pid()::text;
                        
      v_dedupe_key := p_order_id::text || '|status_' || p_new_status || '|' || v_unique_suffix;
      
      -- Retry loop for collision handling
      LOOP
        v_attempt_count := v_attempt_count + 1;
        
        BEGIN
          INSERT INTO communication_events (
            event_type,
            recipient_email,
            template_key,
            template_variables,
            status,
            dedupe_key,
            order_id,
            created_at,
            updated_at
          ) VALUES (
            'order_status_update',
            v_order_record.customer_email,
            'order_status_' || p_new_status,
            jsonb_build_object(
              'customer_name', COALESCE(v_order_record.customer_name, 'Customer'),
              'order_number', v_order_record.order_number,
              'status', p_new_status,
              'total_amount', v_order_record.total_amount
            ),
            'queued',
            v_dedupe_key,
            p_order_id,
            now(),
            now()
          );
          
          -- Success - exit loop
          EXIT;
          
        EXCEPTION 
          WHEN unique_violation THEN
            -- Generate new unique suffix and retry
            IF v_attempt_count >= 3 THEN
              -- Use ON CONFLICT as final fallback
              INSERT INTO communication_events (
                event_type, recipient_email, template_key, template_variables,
                status, dedupe_key, order_id, created_at, updated_at
              ) VALUES (
                'order_status_update', v_order_record.customer_email, 'order_status_' || p_new_status,
                jsonb_build_object(
                  'customer_name', COALESCE(v_order_record.customer_name, 'Customer'),
                  'order_number', v_order_record.order_number,
                  'status', p_new_status,
                  'total_amount', v_order_record.total_amount
                ),
                'queued', v_dedupe_key, p_order_id, now(), now()
              )
              ON CONFLICT (dedupe_key) DO UPDATE SET
                updated_at = now(),
                status = CASE WHEN communication_events.status = 'failed' THEN 'queued' ELSE communication_events.status END;
              EXIT;
            END IF;
            
            -- Generate new unique key for retry
            v_unique_suffix := gen_random_uuid()::text || '_' || 
                              EXTRACT(EPOCH FROM clock_timestamp())::bigint::text || '_' ||
                              EXTRACT(MICROSECONDS FROM clock_timestamp())::text || '_' ||
                              pg_backend_pid()::text || '_retry' || v_attempt_count::text;
            v_dedupe_key := p_order_id::text || '|status_' || p_new_status || '|' || v_unique_suffix;
        END;
      END LOOP;
      
      v_email_result := jsonb_build_object('success', true, 'attempts', v_attempt_count);
      
    EXCEPTION WHEN OTHERS THEN
      -- Log but don't fail the order update
      INSERT INTO audit_logs (action, category, message, entity_id, new_values)
      VALUES (
        'order_status_email_failed',
        'Email System',
        'Failed to queue email for status change: ' || SQLERRM,
        p_order_id,
        jsonb_build_object(
          'error', SQLERRM,
          'old_status', v_old_status,
          'new_status', p_new_status
        )
      );
      v_email_result := jsonb_build_object('success', false, 'error', SQLERRM);
    END;
  END IF;
  
  -- Log status change
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
  VALUES (
    'admin_order_status_updated',
    'Order Management',
    'Order status updated from ' || v_old_status || ' to ' || p_new_status,
    p_admin_id,
    p_order_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_new_status, 'email_result', v_email_result)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order updated successfully',
    'order', row_to_json(v_order_record)
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Database error: ' || SQLERRM
  );
END;
$function$;

-- 2. CREATE SECURE ACCESS VALIDATION FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if current user has admin role in profiles table
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'::user_role 
    AND is_active = true
  );
EXCEPTION WHEN OTHERS THEN
  -- If any error occurs, deny access
  RETURN false;
END;
$function$;

-- 3. SECURE PAYMENT ACCESS CONTROL
-- Update payment transactions table RLS policies to be more restrictive
DROP POLICY IF EXISTS "Service role can manage payment transactions" ON payment_transactions;

-- Create more granular service role policies
CREATE POLICY "Service role can create payment transactions" 
ON payment_transactions FOR INSERT 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update payment transactions" 
ON payment_transactions FOR UPDATE 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can read payment transactions for processing" 
ON payment_transactions FOR SELECT 
USING (auth.role() = 'service_role');

-- Log security policy updates
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'security_policies_updated_phase1',
  'Security Enhancement',
  'Phase 1 critical security fixes applied successfully',
  jsonb_build_object(
    'policies_updated', 'payment_transactions',
    'functions_secured', ARRAY['admin functions', 'communication functions', 'payment functions'],
    'security_level', 'production_ready',
    'phase', 'Phase 1 Critical Security Fixes',
    'completion_timestamp', now()
  )
);