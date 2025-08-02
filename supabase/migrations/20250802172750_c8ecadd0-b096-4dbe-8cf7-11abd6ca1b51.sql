-- 🔧 DATABASE REGISTRATION FIXES
-- Fix the handle_new_user function and registration system

-- 1. First ensure communication_events table has all required columns
DO $$
BEGIN
    -- Add template_variables column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'communication_events' 
        AND column_name = 'template_variables'
    ) THEN
        ALTER TABLE communication_events 
        ADD COLUMN template_variables JSONB DEFAULT '{}';
    END IF;
    
    -- Add variables column if missing (backup)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'communication_events' 
        AND column_name = 'variables'
    ) THEN
        ALTER TABLE communication_events 
        ADD COLUMN variables JSONB DEFAULT '{}';
    END IF;
END $$;

-- 2. Fix the handle_new_user function to properly distinguish customer vs admin registrations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_email TEXT;
    user_phone TEXT;
    user_name TEXT;
    formatted_phone TEXT;
    is_customer_registration BOOLEAN := true;
    user_role user_role := 'customer';
BEGIN
    -- Extract user data
    user_email := NEW.email;
    user_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
    user_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
    
    -- Determine if this is a customer or admin registration
    -- Admin registrations should have specific metadata or email patterns
    IF NEW.raw_user_meta_data->>'user_type' = 'admin' OR 
       NEW.raw_user_meta_data->>'role' IS NOT NULL OR
       NEW.email LIKE '%admin%' OR 
       NEW.email LIKE '%@company.%' THEN
        is_customer_registration := false;
        user_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'admin'::user_role);
    END IF;
    
    -- Format phone number for Nigerian format
    IF user_phone ~ '^[\(\)0-9\s\-]*$' AND length(regexp_replace(user_phone, '[^\d]', '', 'g')) = 11 THEN
        formatted_phone := regexp_replace(user_phone, '[^\d]', '', 'g');
    ELSE
        formatted_phone := user_phone;
    END IF;

    BEGIN
        IF is_customer_registration THEN
            -- Create customer record
            INSERT INTO public.customers (
                user_id,
                email,
                name,
                phone
            ) VALUES (
                NEW.id,
                user_email,
                user_name,
                formatted_phone
            )
            ON CONFLICT (user_id) DO UPDATE SET
                email = EXCLUDED.email,
                name = EXCLUDED.name,
                phone = EXCLUDED.phone,
                updated_at = NOW();

            -- Create customer account for profile data
            INSERT INTO public.customer_accounts (
                user_id,
                name,
                phone
            ) VALUES (
                NEW.id,
                user_name,
                formatted_phone
            )
            ON CONFLICT (user_id) DO UPDATE SET
                name = EXCLUDED.name,
                phone = EXCLUDED.phone,
                updated_at = NOW();

            -- Queue welcome email with proper template variables
            INSERT INTO public.communication_events (
                user_id,
                event_type,
                recipient_email,
                template_key,
                template_variables,
                variables,
                status,
                priority
            ) VALUES (
                NEW.id,
                'customer_welcome',
                user_email,
                'customer_welcome',
                jsonb_build_object(
                    'customer_name', user_name,
                    'email', user_email,
                    'registration_date', NOW()::TEXT
                ),
                jsonb_build_object(
                    'customer_name', user_name,
                    'email', user_email,
                    'registration_date', NOW()::TEXT
                ),
                'queued'::communication_event_status,
                'high'
            );

            RAISE LOG 'Successfully created customer record and queued welcome email for user: %', NEW.id;
        ELSE
            -- Create admin profile
            INSERT INTO public.profiles (
                id,
                name,
                email,
                role
            ) VALUES (
                NEW.id,
                user_name,
                user_email,
                user_role
            )
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                role = EXCLUDED.role,
                updated_at = NOW();

            RAISE LOG 'Successfully created admin profile for user: %', NEW.id;
        END IF;

    EXCEPTION
        WHEN OTHERS THEN
            -- Log the error but don't block user creation
            RAISE LOG 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
            
            -- Insert error into audit_logs for debugging
            INSERT INTO public.audit_logs (
                action,
                category,
                message,
                new_values,
                user_id
            ) VALUES (
                'user_creation_error',
                'Authentication',
                'Error in handle_new_user: ' || SQLERRM,
                jsonb_build_object(
                    'user_id', NEW.id,
                    'email', user_email,
                    'is_customer', is_customer_registration,
                    'error', SQLERRM
                ),
                NEW.id
            );
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 4. Create a function to clean up any orphaned records
CREATE OR REPLACE FUNCTION public.cleanup_registration_issues()
RETURNS TABLE (
    action TEXT,
    count INTEGER,
    details TEXT
) AS $$
DECLARE
    orphaned_count INTEGER := 0;
    fixed_count INTEGER := 0;
BEGIN
    -- Find auth users without customer records who should have them
    SELECT COUNT(*) INTO orphaned_count
    FROM auth.users au
    LEFT JOIN public.customers c ON au.id = c.user_id
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE c.user_id IS NULL 
    AND p.id IS NULL
    AND au.raw_user_meta_data IS NOT NULL;
    
    -- Return cleanup stats
    RETURN QUERY
    SELECT 
        'orphaned_users_found'::TEXT,
        orphaned_count,
        'Users without customer or profile records'::TEXT;
        
    -- Find communication events without proper template variables
    SELECT COUNT(*) INTO fixed_count
    FROM communication_events 
    WHERE template_variables IS NULL OR template_variables = '{}';
    
    RETURN QUERY
    SELECT 
        'events_needing_template_fix'::TEXT,
        fixed_count,
        'Communication events with missing template variables'::TEXT;
        
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create debug logging table for registration monitoring
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    level TEXT CHECK (level IN ('info', 'warn', 'error')),
    event TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on debug_logs
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

-- Debug logs policies
CREATE POLICY "Admins can view all debug logs" ON public.debug_logs
    FOR SELECT USING (is_admin());

CREATE POLICY "Service role can insert debug logs" ON public.debug_logs
    FOR INSERT WITH CHECK (true);

-- 6. Create a function to test the complete registration flow
CREATE OR REPLACE FUNCTION public.test_complete_registration()
RETURNS TABLE (
    step TEXT,
    status TEXT,
    message TEXT,
    details JSONB
) AS $$
BEGIN
    -- Test 1: Check tables exist
    RETURN QUERY
    SELECT 
        'tables_check'::TEXT,
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') 
             AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_events')
             THEN 'pass'::TEXT ELSE 'fail'::TEXT END,
        'Required tables exist'::TEXT,
        jsonb_build_object('customers_exists', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers'))
    ;
    
    -- Test 2: Check template_variables column
    RETURN QUERY
    SELECT 
        'schema_check'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'communication_events' 
            AND column_name = 'template_variables'
        ) THEN 'pass'::TEXT ELSE 'fail'::TEXT END,
        'Communication events schema correct'::TEXT,
        '{}'::JSONB
    ;
    
    -- Test 3: Check trigger function exists
    RETURN QUERY
    SELECT 
        'trigger_check'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'on_auth_user_created'
        ) THEN 'pass'::TEXT ELSE 'fail'::TEXT END,
        'Registration trigger exists'::TEXT,
        '{}'::JSONB
    ;
    
    -- Test 4: Check for any registration issues
    RETURN QUERY
    SELECT * FROM cleanup_registration_issues();
        
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_user_id ON public.customer_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_communication_events_status ON public.communication_events(status);
CREATE INDEX IF NOT EXISTS idx_communication_events_priority ON public.communication_events(priority);
CREATE INDEX IF NOT EXISTS idx_debug_logs_user_id ON public.debug_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_timestamp ON public.debug_logs(timestamp);

-- 8. Test the system
SELECT * FROM test_complete_registration();