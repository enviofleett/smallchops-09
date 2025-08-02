-- Comprehensive Production Fix for Customer Registration
-- Phase 1: Clean up conflicting triggers and constraints

-- Drop problematic triggers and functions first
DROP TRIGGER IF EXISTS on_customer_auth_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_customer_registration();

-- Remove duplicate unique constraints on customers email (keep the primary one)
DO $$ 
BEGIN
    -- Check if there are multiple unique constraints on email and remove extras
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'customers' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name != 'customers_email_key'
    ) THEN
        -- Drop any extra unique constraints (keeping the main one)
        EXECUTE 'ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_email_unique';
        EXECUTE 'ALTER TABLE customers DROP CONSTRAINT IF EXISTS unique_customer_email';
    END IF;
END $$;

-- Phase 2: Create enhanced registration monitoring and error handling
CREATE TABLE IF NOT EXISTS public.registration_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    attempt_type text NOT NULL, -- 'frontend', 'admin', 'api'
    status text NOT NULL, -- 'success', 'failed', 'partial'
    error_details jsonb,
    user_id uuid,
    customer_id uuid,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on registration attempts
ALTER TABLE public.registration_attempts ENABLE ROW LEVEL SECURITY;

-- RLS policies for registration attempts
CREATE POLICY "Admins can view all registration attempts"
ON public.registration_attempts FOR SELECT
USING (is_admin());

CREATE POLICY "Service roles can manage registration attempts"
ON public.registration_attempts FOR ALL
USING (auth.role() = 'service_role');

-- Phase 3: Enhanced customer registration function with comprehensive error handling
CREATE OR REPLACE FUNCTION public.handle_new_customer_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    customer_uuid uuid;
    v_name text;
    v_phone text;
    v_error_context text := '';
BEGIN
    -- Log registration attempt start
    INSERT INTO public.registration_attempts (
        email, attempt_type, status, user_id, error_details
    ) VALUES (
        NEW.email, 'frontend', 'started', NEW.id, 
        jsonb_build_object('step', 'trigger_started', 'user_metadata', NEW.raw_user_meta_data)
    );

    BEGIN
        -- Extract name and phone from metadata
        v_name := COALESCE(
            NEW.raw_user_meta_data->>'name',
            NEW.raw_user_meta_data->>'full_name',
            split_part(NEW.email, '@', 1)
        );
        v_phone := NEW.raw_user_meta_data->>'phone';
        
        v_error_context := 'extracting_metadata';

        -- Create customer record
        INSERT INTO public.customers (name, email, phone)
        VALUES (v_name, NEW.email, v_phone)
        RETURNING id INTO customer_uuid;
        
        v_error_context := 'customer_created';

        -- Create customer account linking record
        INSERT INTO public.customer_accounts (user_id, name, phone)
        VALUES (NEW.id, v_name, v_phone)
        ON CONFLICT (user_id) DO UPDATE SET
            name = EXCLUDED.name,
            phone = EXCLUDED.phone,
            updated_at = now();
            
        v_error_context := 'customer_account_linked';

        -- Queue welcome email
        INSERT INTO public.communication_events (
            event_type, recipient_email, status, template_variables, email_type
        ) VALUES (
            'customer_welcome',
            NEW.email,
            'queued'::communication_event_status,
            jsonb_build_object(
                'customer_name', v_name,
                'customer_email', NEW.email
            ),
            'transactional'
        );
        
        v_error_context := 'welcome_email_queued';

        -- Log successful registration
        UPDATE public.registration_attempts 
        SET 
            status = 'success',
            customer_id = customer_uuid,
            error_details = jsonb_build_object(
                'customer_id', customer_uuid,
                'customer_name', v_name,
                'welcome_email_queued', true
            )
        WHERE user_id = NEW.id AND status = 'started';

        RETURN NEW;

    EXCEPTION
        WHEN unique_violation THEN
            -- Handle duplicate customer email
            IF SQLSTATE = '23505' AND SQLERRM LIKE '%customers_email%' THEN
                -- Update registration attempt with specific error
                UPDATE public.registration_attempts 
                SET 
                    status = 'failed',
                    error_details = jsonb_build_object(
                        'error_type', 'duplicate_email',
                        'context', v_error_context,
                        'message', 'Customer with this email already exists',
                        'sqlstate', SQLSTATE
                    )
                WHERE user_id = NEW.id AND status = 'started';
                
                -- Link existing customer to new auth user
                SELECT id INTO customer_uuid FROM public.customers WHERE email = NEW.email;
                
                INSERT INTO public.customer_accounts (user_id, name, phone)
                VALUES (NEW.id, v_name, v_phone)
                ON CONFLICT (user_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    phone = EXCLUDED.phone,
                    updated_at = now();
                    
                RETURN NEW;
            ELSE
                RAISE;
            END IF;
            
        WHEN OTHERS THEN
            -- Log any other errors
            UPDATE public.registration_attempts 
            SET 
                status = 'failed',
                error_details = jsonb_build_object(
                    'error_type', 'database_error',
                    'context', v_error_context,
                    'message', SQLERRM,
                    'sqlstate', SQLSTATE,
                    'error_detail', SQLSTATE || ': ' || SQLERRM
                )
            WHERE user_id = NEW.id AND status = 'started';
            
            -- Re-raise the error to prevent user creation
            RAISE EXCEPTION 'Registration failed at %: % (SQLSTATE: %)', v_error_context, SQLERRM, SQLSTATE;
    END;
END;
$$;

-- Phase 4: Ensure only one trigger exists for customer registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_customer_registration ON auth.users;

-- Create the main registration trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_customer_registration();

-- Phase 5: Create utility function to diagnose registration issues
CREATE OR REPLACE FUNCTION public.diagnose_registration_issues(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_auth_user_exists boolean;
    v_customer_exists boolean;
    v_customer_account_exists boolean;
    v_recent_attempts jsonb;
    v_diagnosis jsonb;
BEGIN
    -- Check if auth user exists
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = p_email) INTO v_auth_user_exists;
    
    -- Check if customer exists
    SELECT EXISTS(SELECT 1 FROM public.customers WHERE email = p_email) INTO v_customer_exists;
    
    -- Check if customer account exists
    SELECT EXISTS(
        SELECT 1 FROM public.customer_accounts ca 
        JOIN auth.users au ON ca.user_id = au.id 
        WHERE au.email = p_email
    ) INTO v_customer_account_exists;
    
    -- Get recent registration attempts
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'status', status,
            'attempt_type', attempt_type,
            'error_details', error_details,
            'created_at', created_at
        ) ORDER BY created_at DESC
    ) INTO v_recent_attempts
    FROM public.registration_attempts 
    WHERE email = p_email 
    AND created_at > now() - interval '24 hours'
    LIMIT 10;
    
    v_diagnosis := jsonb_build_object(
        'email', p_email,
        'auth_user_exists', v_auth_user_exists,
        'customer_exists', v_customer_exists,
        'customer_account_exists', v_customer_account_exists,
        'recent_attempts', COALESCE(v_recent_attempts, '[]'::jsonb),
        'diagnosis_time', now()
    );
    
    RETURN v_diagnosis;
END;
$$;

-- Phase 6: Create function to safely recover from failed registrations
CREATE OR REPLACE FUNCTION public.recover_failed_registration(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_auth_user_id uuid;
    v_customer_id uuid;
    v_recovery_actions text[] := '{}';
    v_result jsonb;
BEGIN
    -- Get auth user ID
    SELECT id INTO v_auth_user_id FROM auth.users WHERE email = p_email;
    
    IF v_auth_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No auth user found for email: ' || p_email
        );
    END IF;
    
    -- Ensure customer record exists
    INSERT INTO public.customers (name, email, phone)
    VALUES (
        split_part(p_email, '@', 1),
        p_email,
        NULL
    )
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO v_customer_id;
    
    IF v_customer_id IS NOT NULL THEN
        v_recovery_actions := array_append(v_recovery_actions, 'created_customer_record');
    ELSE
        SELECT id INTO v_customer_id FROM public.customers WHERE email = p_email;
        v_recovery_actions := array_append(v_recovery_actions, 'found_existing_customer');
    END IF;
    
    -- Ensure customer account link exists
    INSERT INTO public.customer_accounts (user_id, name, phone)
    VALUES (
        v_auth_user_id,
        split_part(p_email, '@', 1),
        NULL
    )
    ON CONFLICT (user_id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = now();
        
    v_recovery_actions := array_append(v_recovery_actions, 'linked_customer_account');
    
    -- Queue welcome email if not already sent
    IF NOT EXISTS (
        SELECT 1 FROM public.communication_events 
        WHERE recipient_email = p_email 
        AND event_type = 'customer_welcome'
        AND status IN ('sent', 'delivered')
    ) THEN
        INSERT INTO public.communication_events (
            event_type, recipient_email, status, template_variables, email_type
        ) VALUES (
            'customer_welcome',
            p_email,
            'queued'::communication_event_status,
            jsonb_build_object(
                'customer_name', split_part(p_email, '@', 1),
                'customer_email', p_email
            ),
            'transactional'
        );
        v_recovery_actions := array_append(v_recovery_actions, 'queued_welcome_email');
    END IF;
    
    -- Log recovery action
    INSERT INTO public.registration_attempts (
        email, attempt_type, status, user_id, customer_id, error_details
    ) VALUES (
        p_email, 'recovery', 'success', v_auth_user_id, v_customer_id,
        jsonb_build_object(
            'recovery_actions', v_recovery_actions,
            'recovered_at', now()
        )
    );
    
    v_result := jsonb_build_object(
        'success', true,
        'email', p_email,
        'auth_user_id', v_auth_user_id,
        'customer_id', v_customer_id,
        'recovery_actions', v_recovery_actions,
        'recovered_at', now()
    );
    
    RETURN v_result;
END;
$$;