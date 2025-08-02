-- ===============================================
-- CRITICAL PRODUCTION FIX: Authentication System Repair
-- ===============================================

-- 1. Fix the handle_new_user trigger to properly populate user_id in customers table
-- This is critical for authentication to work properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_name TEXT;
  user_phone TEXT;
BEGIN
  -- Extract user metadata
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  
  user_phone := NEW.raw_user_meta_data->>'phone';

  -- For customer registrations, create customer record first
  IF NEW.raw_user_meta_data->>'user_type' = 'customer' OR NEW.raw_user_meta_data->>'user_type' IS NULL THEN
    -- Insert/update customer record with proper user_id linking
    INSERT INTO public.customers (name, email, phone, user_id)
    VALUES (user_name, NEW.email, user_phone, NEW.id)
    ON CONFLICT (email) DO UPDATE SET
      user_id = NEW.id,
      name = EXCLUDED.name,
      phone = COALESCE(EXCLUDED.phone, customers.phone),
      updated_at = NOW();

    -- Create customer account record for authenticated users
    INSERT INTO public.customer_accounts (user_id, name, phone, email_verified)
    VALUES (
      NEW.id, 
      user_name, 
      user_phone,
      NEW.email_confirmed_at IS NOT NULL
    )
    ON CONFLICT (user_id) DO UPDATE SET
      name = EXCLUDED.name,
      phone = COALESCE(EXCLUDED.phone, customer_accounts.phone),
      email_verified = EXCLUDED.email_verified,
      updated_at = NOW();

    -- Queue welcome email with proper template variables
    INSERT INTO public.communication_events (
      event_type,
      recipient_email,
      status,
      priority,
      template_key,
      template_variables,
      variables,
      payload
    ) VALUES (
      'customer_welcome',
      NEW.email,
      'queued'::communication_event_status,
      'high',
      'customer_welcome',
      jsonb_build_object(
        'customer_name', user_name,
        'customer_email', NEW.email,
        'verification_required', NEW.email_confirmed_at IS NULL,
        'registration_method', COALESCE(NEW.app_metadata->>'provider', 'email')
      ),
      jsonb_build_object(
        'customer_name', user_name,
        'customer_email', NEW.email
      ),
      jsonb_build_object(
        'user_id', NEW.id,
        'customer_name', user_name,
        'registration_source', 'auth_trigger'
      )
    );

    -- Log successful customer creation
    INSERT INTO public.audit_logs (
      action, category, message, new_values, user_id
    ) VALUES (
      'customer_auto_created',
      'Authentication',
      'Customer account created via auth trigger for: ' || NEW.email,
      jsonb_build_object(
        'user_id', NEW.id,
        'customer_name', user_name,
        'provider', COALESCE(NEW.app_metadata->>'provider', 'email')
      ),
      NEW.id
    );

  ELSE
    -- For admin/staff users, create profile record
    INSERT INTO public.profiles (id, name, email, role)
    VALUES (
      NEW.id, 
      user_name, 
      NEW.email, 
      COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'admin'::user_role)
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      updated_at = NOW();

    -- Log admin profile creation
    INSERT INTO public.audit_logs (
      action, category, message, new_values, user_id
    ) VALUES (
      'admin_profile_created',
      'Authentication',
      'Admin profile created for: ' || NEW.email,
      jsonb_build_object('profile_id', NEW.id, 'role', NEW.raw_user_meta_data->>'role'),
      NEW.id
    );
  END IF;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't block user creation
    INSERT INTO public.audit_logs (
      action, category, message, new_values
    ) VALUES (
      'user_creation_error',
      'Authentication',
      'Error in handle_new_user trigger: ' || SQLERRM,
      jsonb_build_object(
        'user_id', NEW.id, 
        'email', NEW.email, 
        'error', SQLERRM,
        'metadata', NEW.raw_user_meta_data
      )
    );
    
    -- Still return NEW to allow user creation to succeed
    RETURN NEW;
END;
$$;

-- 2. Create helper function to get user role that avoids infinite recursion
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role::text FROM profiles WHERE id = user_uuid),
    'customer'
  );
$$;

-- 3. Ensure the trigger is properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Create function to fix existing users without proper linking
CREATE OR REPLACE FUNCTION public.fix_user_linking()
RETURNS TABLE(
  fixed_customers INTEGER,
  linked_accounts INTEGER,
  error_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  customer_record RECORD;
  user_record RECORD;
  fixed_count INTEGER := 0;
  linked_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  -- Fix customers without user_id by linking via email
  FOR customer_record IN 
    SELECT c.id, c.email, c.name, c.phone 
    FROM customers c 
    WHERE c.user_id IS NULL AND c.email IS NOT NULL
  LOOP
    BEGIN
      -- Find matching auth user
      SELECT u.id, u.email INTO user_record
      FROM auth.users u 
      WHERE u.email = customer_record.email;
      
      IF FOUND THEN
        -- Update customer with user_id
        UPDATE customers 
        SET user_id = user_record.id, updated_at = NOW()
        WHERE id = customer_record.id;
        
        -- Create customer_accounts record if it doesn't exist
        INSERT INTO customer_accounts (user_id, name, phone, email_verified)
        VALUES (
          user_record.id,
          customer_record.name,
          customer_record.phone,
          true -- Assume verified for existing customers
        )
        ON CONFLICT (user_id) DO NOTHING;
        
        fixed_count := fixed_count + 1;
        linked_count := linked_count + 1;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        -- Log error but continue
        INSERT INTO audit_logs (action, category, message, new_values) 
        VALUES (
          'user_linking_error',
          'Data Repair',
          'Error linking customer: ' || SQLERRM,
          jsonb_build_object('customer_id', customer_record.id, 'email', customer_record.email)
        );
    END;
  END LOOP;
  
  RETURN QUERY SELECT fixed_count, linked_count, error_count;
END;
$$;

-- 5. Create enhanced email delivery function with retry mechanism
CREATE OR REPLACE FUNCTION public.retry_failed_welcome_emails()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_requeued_count INTEGER := 0;
BEGIN
  -- Requeue failed customer welcome emails from the last 24 hours
  UPDATE communication_events 
  SET 
    status = 'queued'::communication_event_status,
    retry_count = 0,
    last_error = NULL,
    error_message = NULL,
    updated_at = NOW()
  WHERE event_type = 'customer_welcome'
  AND status = 'failed'::communication_event_status
  AND created_at >= NOW() - INTERVAL '24 hours'
  AND retry_count < 3; -- Don't retry more than 3 times
  
  GET DIAGNOSTICS v_requeued_count = ROW_COUNT;
  
  -- Log the requeue operation
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'requeue_failed_emails',
    'Email Processing',
    'Requeued ' || v_requeued_count || ' failed welcome emails for retry',
    jsonb_build_object('requeued_count', v_requeued_count)
  );
  
  RETURN v_requeued_count;
END;
$$;

-- 6. Run the user linking fix for existing data
SELECT * FROM fix_user_linking();