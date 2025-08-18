
-- 1) Harden sync_customer_email_verification to never block signup
CREATE OR REPLACE FUNCTION public.sync_customer_email_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    -- Sync verified flag and ensure email is present
    UPDATE public.customer_accounts 
    SET 
      email_verified = (NEW.email_confirmed_at IS NOT NULL),
      email = COALESCE(email, NEW.email),
      updated_at = NOW()
    WHERE user_id = NEW.id;

    -- If no row was updated and the user just got verified, create the account
    IF NOT FOUND AND NEW.email_confirmed_at IS NOT NULL THEN
      INSERT INTO public.customer_accounts (
        user_id, 
        email, 
        name, 
        email_verified, 
        created_at, 
        updated_at
      ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        email_verified = EXCLUDED.email_verified,
        email = COALESCE(public.customer_accounts.email, EXCLUDED.email),
        updated_at = NOW();
    END IF;

    RETURN NEW;
  EXCEPTION
    WHEN OTHERS THEN
      -- Non-blocking: log and continue
      INSERT INTO public.audit_logs (
        action, category, message, user_id, new_values
      ) VALUES (
        'sync_customer_email_verification_failed',
        'Authentication',
        'Non-blocking: sync_customer_email_verification failed: ' || SQLERRM,
        NEW.id,
        jsonb_build_object(
          'user_id', NEW.id,
          'email', NEW.email,
          'sqlstate', SQLSTATE
        )
      );
      RETURN NEW;
  END;
END;
$function$;

-- 2) Harden handle_new_customer_user and store email up front
CREATE OR REPLACE FUNCTION public.handle_new_customer_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_name  TEXT;
  user_email TEXT;
BEGIN
  BEGIN
    user_email := NEW.email;
    user_name := COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name', 
      split_part(NEW.email, '@', 1)
    );

    -- Create or update customer_accounts with email included
    INSERT INTO public.customer_accounts (
      user_id, 
      name, 
      phone, 
      email,
      email_verified,
      phone_verified,
      profile_completion_percentage
    ) VALUES (
      NEW.id,
      user_name,
      NEW.raw_user_meta_data->>'phone',
      user_email,
      NEW.email_confirmed_at IS NOT NULL,
      false,
      CASE 
        WHEN NEW.raw_user_meta_data->>'phone' IS NOT NULL THEN 80 
        ELSE 60 
      END
    )
    ON CONFLICT (user_id) DO UPDATE SET
      name = EXCLUDED.name,
      email = COALESCE(public.customer_accounts.email, EXCLUDED.email),
      email_verified = EXCLUDED.email_verified,
      profile_completion_percentage = EXCLUDED.profile_completion_percentage,
      updated_at = NOW();

    -- Maintain compatibility with public.customers
    INSERT INTO public.customers (
      user_id,
      name,
      email,
      phone,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      user_name,
      user_email,
      NEW.raw_user_meta_data->>'phone',
      NOW(),
      NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      updated_at = NOW()
    WHERE customers.user_id IS NULL; -- Only link if not already linked

    RETURN NEW;
  EXCEPTION
    WHEN OTHERS THEN
      -- Non-blocking: log and continue
      INSERT INTO public.audit_logs (
        action, category, message, user_id, new_values
      ) VALUES (
        'handle_new_customer_user_failed',
        'Authentication',
        'Non-blocking: handle_new_customer_user failed: ' || SQLERRM,
        NEW.id,
        jsonb_build_object(
          'user_id', NEW.id,
          'email', NEW.email,
          'sqlstate', SQLSTATE
        )
      );
      RETURN NEW;
  END;
END;
$function$;

-- 3) Backfill customer_accounts for any existing users missing a row
INSERT INTO public.customer_accounts (user_id, email, name, email_verified, created_at, updated_at)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  (u.email_confirmed_at IS NOT NULL),
  NOW(),
  NOW()
FROM auth.users u
LEFT JOIN public.customer_accounts c ON c.user_id = u.id
WHERE c.id IS NULL
ON CONFLICT DO NOTHING;
