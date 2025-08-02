-- Comprehensive Customer Deletion & Re-registration Fix

-- 1. Create enhanced delete_customer_cascade function
CREATE OR REPLACE FUNCTION public.delete_customer_cascade(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_customer_record RECORD;
  v_user_id UUID;
  v_deleted_records JSONB := '{}';
  v_result JSONB;
BEGIN
  -- Get customer details
  SELECT * INTO v_customer_record FROM customers WHERE id = p_customer_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Customer not found'
    );
  END IF;

  -- Find associated auth user if exists
  SELECT ca.user_id INTO v_user_id 
  FROM customer_accounts ca 
  WHERE ca.id = p_customer_id;

  -- Start deletion process with proper logging
  INSERT INTO audit_logs (
    action, category, message, new_values
  ) VALUES (
    'customer_deletion_started',
    'Customer Management',
    'Starting comprehensive customer deletion for: ' || v_customer_record.email,
    jsonb_build_object('customer_id', p_customer_id, 'email', v_customer_record.email)
  );

  -- Delete customer_accounts record first
  DELETE FROM customer_accounts WHERE id = p_customer_id;
  GET DIAGNOSTICS v_deleted_records = ROW_COUNT;
  v_deleted_records := jsonb_build_object('customer_accounts', v_deleted_records);

  -- Delete customer favorites
  WITH deleted_favorites AS (
    DELETE FROM customer_favorites WHERE customer_id = p_customer_id RETURNING *
  )
  SELECT count(*) INTO v_deleted_records FROM deleted_favorites;
  v_deleted_records := v_deleted_records || jsonb_build_object('favorites', COALESCE((v_deleted_records->>'favorites')::int, 0));

  -- Delete customer notification preferences
  WITH deleted_notifications AS (
    DELETE FROM customer_notification_preferences WHERE customer_id = p_customer_id RETURNING *
  )
  SELECT count(*) INTO v_deleted_records FROM deleted_notifications;
  v_deleted_records := v_deleted_records || jsonb_build_object('notification_preferences', COALESCE((v_deleted_records->>'notification_preferences')::int, 0));

  -- Delete customer delivery preferences
  WITH deleted_delivery AS (
    DELETE FROM customer_delivery_preferences WHERE customer_id = p_customer_id RETURNING *
  )
  SELECT count(*) INTO v_deleted_records FROM deleted_delivery;
  v_deleted_records := v_deleted_records || jsonb_build_object('delivery_preferences', COALESCE((v_deleted_records->>'delivery_preferences')::int, 0));

  -- Clean up communication events for this email
  WITH deleted_comm AS (
    DELETE FROM communication_events WHERE recipient_email = v_customer_record.email RETURNING *
  )
  SELECT count(*) INTO v_deleted_records FROM deleted_comm;
  v_deleted_records := v_deleted_records || jsonb_build_object('communication_events', COALESCE((v_deleted_records->>'communication_events')::int, 0));

  -- Delete from email suppression list if exists
  DELETE FROM email_suppression_list WHERE email_address = v_customer_record.email;

  -- Delete the main customer record
  DELETE FROM customers WHERE id = p_customer_id;
  v_deleted_records := v_deleted_records || jsonb_build_object('customer_record', 1);

  -- Delete auth.users record if it exists (this is the key fix!)
  IF v_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_user_id;
    v_deleted_records := v_deleted_records || jsonb_build_object('auth_user', 1);
  END IF;

  -- Log successful deletion
  INSERT INTO audit_logs (
    action, category, message, new_values
  ) VALUES (
    'customer_deletion_completed',
    'Customer Management',
    'Successfully deleted customer and all related data: ' || v_customer_record.email,
    jsonb_build_object(
      'customer_id', p_customer_id, 
      'email', v_customer_record.email,
      'deleted_records', v_deleted_records,
      'auth_user_deleted', v_user_id IS NOT NULL
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'customer_id', p_customer_id,
    'email', v_customer_record.email,
    'deleted_records', v_deleted_records,
    'message', 'Customer and all related data deleted successfully'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO audit_logs (
      action, category, message, new_values
    ) VALUES (
      'customer_deletion_failed',
      'Customer Management',
      'Failed to delete customer: ' || SQLERRM,
      jsonb_build_object(
        'customer_id', p_customer_id,
        'email', v_customer_record.email,
        'error', SQLERRM
      )
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Deletion failed: ' || SQLERRM
    );
END;
$$;

-- 2. Create recovery function for stuck emails
CREATE OR REPLACE FUNCTION public.recover_customer_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result JSONB;
  v_cleanup_count INTEGER := 0;
BEGIN
  -- Clean up orphaned customer records
  DELETE FROM customers WHERE email = p_email;
  GET DIAGNOSTICS v_cleanup_count = ROW_COUNT;
  
  -- Clean up orphaned communication events
  DELETE FROM communication_events WHERE recipient_email = p_email;
  
  -- Clean up from email suppression list
  DELETE FROM email_suppression_list WHERE email_address = p_email;
  
  -- Clean up any orphaned customer_accounts (shouldn't exist without customers table, but just in case)
  DELETE FROM customer_accounts WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = p_email
  );
  
  -- Clean up auth.users if they exist
  DELETE FROM auth.users WHERE email = p_email;
  
  -- Log the recovery
  INSERT INTO audit_logs (
    action, category, message, new_values
  ) VALUES (
    'email_recovery_completed',
    'Customer Management',
    'Recovered email for re-registration: ' || p_email,
    jsonb_build_object(
      'email', p_email,
      'cleanup_count', v_cleanup_count
    )
  );
  
  v_result := jsonb_build_object(
    'success', true,
    'email', p_email,
    'message', 'Email recovered and ready for re-registration'
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Recovery failed: ' || SQLERRM
    );
END;
$$;

-- 3. Immediate cleanup for the problematic email
SELECT public.recover_customer_email('chudesyl@gmail.com');

-- 4. Create monitoring function to detect orphaned records
CREATE OR REPLACE FUNCTION public.detect_orphaned_customer_records()
RETURNS TABLE(
  email text,
  has_customer_record boolean,
  has_auth_user boolean,
  has_customer_account boolean,
  communication_events_count bigint,
  issue_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH all_emails AS (
    SELECT DISTINCT c.email
    FROM customers c
    UNION
    SELECT DISTINCT au.email
    FROM auth.users au
    WHERE au.email IS NOT NULL
    UNION  
    SELECT DISTINCT ce.recipient_email as email
    FROM communication_events ce
    WHERE ce.recipient_email IS NOT NULL
  )
  SELECT 
    ae.email,
    EXISTS(SELECT 1 FROM customers c WHERE c.email = ae.email) as has_customer_record,
    EXISTS(SELECT 1 FROM auth.users au WHERE au.email = ae.email) as has_auth_user,
    EXISTS(SELECT 1 FROM customer_accounts ca 
           JOIN auth.users au ON ca.user_id = au.id 
           WHERE au.email = ae.email) as has_customer_account,
    COALESCE((SELECT COUNT(*) FROM communication_events ce WHERE ce.recipient_email = ae.email), 0) as communication_events_count,
    CASE 
      WHEN EXISTS(SELECT 1 FROM customers c WHERE c.email = ae.email) 
           AND NOT EXISTS(SELECT 1 FROM auth.users au WHERE au.email = ae.email) 
           THEN 'customer_without_auth'
      WHEN NOT EXISTS(SELECT 1 FROM customers c WHERE c.email = ae.email) 
           AND EXISTS(SELECT 1 FROM auth.users au WHERE au.email = ae.email) 
           THEN 'auth_without_customer'
      WHEN EXISTS(SELECT 1 FROM communication_events ce WHERE ce.recipient_email = ae.email)
           AND NOT EXISTS(SELECT 1 FROM customers c WHERE c.email = ae.email)
           AND NOT EXISTS(SELECT 1 FROM auth.users au WHERE au.email = ae.email)
           THEN 'orphaned_communication_events'
      ELSE 'normal'
    END as issue_type
  FROM all_emails ae
  ORDER BY ae.email;
END;
$$;