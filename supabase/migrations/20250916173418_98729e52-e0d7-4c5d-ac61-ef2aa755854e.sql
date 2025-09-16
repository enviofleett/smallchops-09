-- Fix database security issues identified by linter

-- 1. Fix function search_path issues by updating functions with SET search_path
ALTER FUNCTION public.admin_safe_update_order_status_enhanced(uuid, text, uuid) SET search_path = 'public';
ALTER FUNCTION public.admin_safe_update_order_status(uuid, text, uuid) SET search_path = 'public';
ALTER FUNCTION public.upsert_communication_event_enhanced(text, text, text, jsonb, uuid, text) SET search_path = 'public';
ALTER FUNCTION public.log_payment_access(text, uuid, uuid, text) SET search_path = 'public';
ALTER FUNCTION public.secure_verify_payment(text, numeric, uuid) SET search_path = 'public';

-- 2. Move extensions out of public schema (if any exist)
-- Check and move uuid-ossp extension if it exists in public
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp' AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
    END IF;
END
$$;

-- 3. Create security definer function for admin status updates with proper audit trail
CREATE OR REPLACE FUNCTION public.admin_update_order_status_secure(
    p_order_id uuid,
    p_new_status text,
    p_admin_id uuid DEFAULT auth.uid()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_order_record RECORD;
    v_old_status text;
    v_valid_statuses text[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'];
BEGIN
    -- Verify admin permissions
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    -- Validate inputs
    IF p_order_id IS NULL OR p_new_status IS NULL OR p_new_status = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid input parameters');
    END IF;

    IF NOT (p_new_status = ANY(v_valid_statuses)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid status value');
    END IF;

    -- Get current order with row locking
    SELECT * INTO v_order_record FROM orders WHERE id = p_order_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    v_old_status := v_order_record.status::text;
    
    -- Skip if unchanged
    IF v_old_status = p_new_status THEN
        RETURN jsonb_build_object('success', true, 'message', 'Status unchanged', 'order', row_to_json(v_order_record));
    END IF;
    
    -- Update status
    UPDATE orders 
    SET status = p_new_status::order_status,
        updated_at = now(),
        updated_by = p_admin_id
    WHERE id = p_order_id
    RETURNING * INTO v_order_record;
    
    -- Comprehensive audit logging
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, old_values, new_values)
    VALUES (
        'admin_order_status_update_secure',
        'Order Management',
        'PRODUCTION: Admin updated order status from ' || v_old_status || ' to ' || p_new_status,
        p_admin_id,
        p_order_id,
        jsonb_build_object('status', v_old_status),
        jsonb_build_object('status', p_new_status, 'admin_id', p_admin_id, 'timestamp', now())
    );
    
    RETURN jsonb_build_object('success', true, 'message', 'Order updated successfully', 'order', row_to_json(v_order_record));
    
EXCEPTION WHEN OTHERS THEN
    -- Log security-relevant errors
    INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
    VALUES (
        'admin_order_status_update_failed_secure',
        'Security Alert',
        'PRODUCTION: Order status update failed - ' || SQLERRM,
        p_admin_id,
        p_order_id,
        jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
    );
    
    RETURN jsonb_build_object('success', false, 'error', 'Unexpected error: ' || SQLERRM);
END;
$$;

-- 4. Create production monitoring function
CREATE OR REPLACE FUNCTION public.log_admin_action(
    p_action_type text,
    p_order_id uuid,
    p_details jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO audit_logs (
        action,
        category,
        message,
        user_id,
        entity_id,
        new_values
    ) VALUES (
        p_action_type,
        'Admin Action Monitoring',
        'Production admin action: ' || p_action_type,
        auth.uid(),
        p_order_id,
        jsonb_build_object(
            'details', p_details,
            'timestamp', now(),
            'session_info', current_setting('request.headers', true)::jsonb
        )
    );
END;
$$;

-- 5. Grant proper permissions
GRANT EXECUTE ON FUNCTION public.admin_update_order_status_secure(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, uuid, jsonb) TO authenticated;