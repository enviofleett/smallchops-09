-- First create the customer account trigger function
CREATE OR REPLACE FUNCTION public.handle_new_customer_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  user_name TEXT;
  user_phone TEXT;
BEGIN
  -- Handle customer registrations (not admin)
  IF NEW.raw_user_meta_data->>'user_type' = 'customer' OR 
     (NEW.email NOT LIKE '%admin%' AND 
      NEW.email NOT LIKE '%@company.%' AND 
      NEW.raw_user_meta_data->>'role' IS NULL) THEN
    
    user_name := COALESCE(
      NEW.raw_user_meta_data->>'name', 
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    );
    user_phone := NEW.raw_user_meta_data->>'phone';

    -- Insert into customer_accounts table
    INSERT INTO public.customer_accounts (user_id, name, phone)
    VALUES (NEW.id, user_name, user_phone)
    ON CONFLICT (user_id) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      updated_at = NOW();

    -- Log customer account creation
    INSERT INTO public.audit_logs (
      action, category, message, new_values
    ) VALUES (
      'customer_account_created',
      'Authentication',
      'Created customer account for: ' || NEW.email,
      jsonb_build_object('user_id', NEW.id, 'name', user_name)
    );
  END IF;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Log customer account creation errors but don't block auth
    INSERT INTO public.audit_logs (
      action, category, message, new_values
    ) VALUES (
      'customer_account_error',
      'Authentication',
      'Error creating customer account: ' || SQLERRM,
      jsonb_build_object('user_id', NEW.id, 'email', NEW.email, 'error', SQLERRM)
    );
    RETURN NEW;
END;
$function$;

-- Now create the trigger
CREATE TRIGGER on_auth_customer_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer_account();