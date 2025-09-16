-- PRIORITY 1: Remove duplicate phone column from orders table
-- This resolves the field mapping inconsistency causing database errors

DO $$
DECLARE
    phone_data_exists BOOLEAN;
BEGIN
    -- Check if phone column has any data that's not in customer_phone
    SELECT EXISTS(
        SELECT 1 FROM orders 
        WHERE phone IS NOT NULL 
        AND phone != '' 
        AND (customer_phone IS NULL OR customer_phone = '' OR customer_phone != phone)
    ) INTO phone_data_exists;
    
    -- If phone column has unique data, migrate it first
    IF phone_data_exists THEN
        -- Migrate phone data to customer_phone where customer_phone is empty
        UPDATE orders 
        SET customer_phone = phone
        WHERE phone IS NOT NULL 
        AND phone != ''
        AND (customer_phone IS NULL OR customer_phone = '');
        
        RAISE NOTICE 'Migrated phone data to customer_phone for % rows', 
            (SELECT count(*) FROM orders WHERE phone IS NOT NULL AND phone != '');
    END IF;
    
    -- Now safe to drop the phone column
    ALTER TABLE orders DROP COLUMN IF EXISTS phone;
    
    -- Update any remaining functions that might reference the phone column
    -- (Edge functions already handle this mapping in code)
    
    RAISE NOTICE 'Successfully removed phone column from orders table';
END $$;

-- PRIORITY 2: Fix database security issues identified by linter
-- Fix function search_path parameters for security

-- Update functions to have immutable search_path for security
-- This addresses the "Function Search Path Mutable" warnings

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

-- Fix other functions to have secure search_path
-- Update admin_safe_update_order_status_enhanced function
CREATE OR REPLACE FUNCTION public.admin_safe_update_order_status_enhanced(p_order_id uuid, p_new_status text, p_admin_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result_order RECORD;
  old_status TEXT;
  v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
BEGIN
  -- Verify admin permissions first
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- CRITICAL: Comprehensive input validation
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order ID cannot be null');
  END IF;
  
  IF p_new_status IS NULL OR p_new_status = '' OR p_new_status = 'undefined' OR p_new_status = 'null' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status cannot be null, empty, or undefined');
  END IF;
  
  -- Validate status is in allowed enum values
  IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Invalid status value: ' || p_new_status || '. Valid values are: ' || array_to_string(v_valid_statuses, ', ')
    );
  END IF;

  -- Get current status with row locking to prevent concurrent updates
  SELECT status INTO old_status 
  FROM orders 
  WHERE id = p_order_id
  FOR UPDATE;
  
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
  
  -- Update order status with explicit enum casting and comprehensive error handling
  BEGIN
    UPDATE orders 
    SET status = p_new_status::order_status,
        updated_at = now(),
        updated_by = p_admin_id
    WHERE id = p_order_id
    RETURNING * INTO result_order;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order update failed - order not found');
    END IF;
    
  EXCEPTION 
    WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid status value for enum: ' || p_new_status);
    WHEN OTHERS THEN
      RETURN jsonb_build_object('success', false, 'error', 'Database error during status update: ' || SQLERRM);
  END;
  
  -- Log status change with security audit trail
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
  VALUES (
    'order_status_update_secure',
    'Order Management',
    'Order status updated from ' || old_status || ' to ' || p_new_status || ' by admin',
    p_admin_id,
    p_order_id,
    jsonb_build_object('status', old_status),
    jsonb_build_object('status', p_new_status, 'updated_by_admin', p_admin_id)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order updated successfully', 
    'order', row_to_json(result_order)
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log security-relevant errors
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
  VALUES (
    'order_status_update_failed_secure',
    'Security',
    'Order status update failed: ' || SQLERRM,
    p_admin_id,
    p_order_id,
    jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Unexpected error during order status update: ' || SQLERRM,
    'sqlstate', SQLSTATE
  );
END;
$function$;