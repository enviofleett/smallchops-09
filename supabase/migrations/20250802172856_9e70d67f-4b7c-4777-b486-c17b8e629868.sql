-- 🔧 FIXED DATABASE REGISTRATION SYSTEM
-- Fix the handle_new_user function based on actual table structure

-- 1. First ensure communication_events table has template_variables column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'communication_events' 
        AND column_name = 'template_variables'
    ) THEN
        ALTER TABLE communication_events 
        ADD COLUMN template_variables JSONB DEFAULT '{}';
    END IF;
END $$;

-- 2. Add user_id column to customers table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE customers 
        ADD COLUMN user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Create a simple, robust handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_email TEXT;
    user_phone TEXT;
    user_name TEXT;
    formatted_phone TEXT;
    is_admin_reg BOOLEAN := false;
BEGIN
    -- Extract user data safely
    user_email := NEW.email;
    user_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
    user_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
    
    -- Check if this is an admin registration
    IF NEW.raw_user_meta_data->>'user_type' = 'admin' OR 
       NEW.raw_user_meta_data->>'role' IS NOT NULL OR
       NEW.email LIKE '%admin%' THEN
        is_admin_reg := true;
    END IF;
    
    -- Clean phone number (Nigerian format)
    IF user_phone ~ '^[\(\)0-9\s\-]*$' AND length(regexp_replace(user_phone, '[^\d]', '', 'g')) = 11 THEN
        formatted_phone := regexp_replace(user_phone, '[^\d]', '', 'g');
    ELSE
        formatted_phone := user_phone;
    END IF;

    BEGIN
        IF is_admin_reg THEN
            -- Create admin profile
            INSERT INTO public.profiles (
                id, name, email, role
            ) VALUES (
                NEW.id, user_name, user_email, 
                COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'admin'::user_role)
            ) ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                updated_at = NOW();
                
            RAISE LOG 'Created admin profile for: %', user_email;
        ELSE
            -- Create customer records
            INSERT INTO public.customers (
                user_id, email, name, phone
            ) VALUES (
                NEW.id, user_email, user_name, formatted_phone
            ) ON CONFLICT (user_id) DO UPDATE SET
                email = EXCLUDED.email,
                name = EXCLUDED.name,
                phone = EXCLUDED.phone,
                updated_at = NOW();

            -- Create customer account if table exists
            INSERT INTO public.customer_accounts (
                user_id, name, phone
            ) VALUES (
                NEW.id, user_name, formatted_phone
            ) ON CONFLICT (user_id) DO UPDATE SET
                name = EXCLUDED.name,
                phone = EXCLUDED.phone,
                updated_at = NOW();

            -- Queue welcome email
            INSERT INTO public.communication_events (
                user_id, event_type, recipient_email, template_key,
                template_variables, status, priority
            ) VALUES (
                NEW.id, 'customer_welcome', user_email, 'customer_welcome',
                jsonb_build_object(
                    'customer_name', user_name,
                    'email', user_email,
                    'registration_date', NOW()::TEXT
                ),
                'queued'::communication_event_status, 'high'
            );

            RAISE LOG 'Created customer records for: %', user_email;
        END IF;

    EXCEPTION
        WHEN OTHERS THEN
            RAISE LOG 'Error in handle_new_user for %: %', user_email, SQLERRM;
            
            -- Log error for debugging
            INSERT INTO public.audit_logs (
                action, category, message, new_values, user_id
            ) VALUES (
                'user_creation_error', 'Authentication',
                'Error in handle_new_user: ' || SQLERRM,
                jsonb_build_object(
                    'user_id', NEW.id, 'email', user_email,
                    'is_admin', is_admin_reg, 'error', SQLERRM
                ),
                NEW.id
            );
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 5. Create registration test function
CREATE OR REPLACE FUNCTION public.test_registration_system()
RETURNS TABLE (
    component TEXT,
    status TEXT,
    message TEXT
) AS $$
BEGIN
    -- Test customers table structure
    RETURN QUERY
    SELECT 
        'customers_table'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'customers' AND column_name = 'user_id'
        ) THEN 'pass'::TEXT ELSE 'fail'::TEXT END,
        'Customers table has user_id column'::TEXT;
    
    -- Test communication_events schema
    RETURN QUERY
    SELECT 
        'communication_events'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'communication_events' AND column_name = 'template_variables'
        ) THEN 'pass'::TEXT ELSE 'fail'::TEXT END,
        'Communication events has template_variables'::TEXT;
    
    -- Test trigger exists
    RETURN QUERY
    SELECT 
        'trigger_function'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'on_auth_user_created'
        ) THEN 'pass'::TEXT ELSE 'fail'::TEXT END,
        'Registration trigger exists'::TEXT;
        
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Test the system
SELECT * FROM test_registration_system();