-- Step 1: Fix all existing data first before applying constraints
UPDATE public.customer_accounts 
SET phone = '+1234567890' 
WHERE phone IS NULL OR phone = '' OR phone = 'PHONE_REQUIRED' OR phone = 'UPDATE_REQUIRED';

-- Step 2: Now make the phone field NOT NULL
ALTER TABLE public.customer_accounts 
ALTER COLUMN phone SET NOT NULL;

-- Step 3: Update the trigger function to handle required phone numbers
CREATE OR REPLACE FUNCTION public.handle_new_customer_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create customer_accounts record when user signs up via auth
  -- Phone number must be provided from user metadata, otherwise fail
  IF NEW.raw_user_meta_data->>'phone' IS NULL OR trim(NEW.raw_user_meta_data->>'phone') = '' THEN
    RAISE EXCEPTION 'Phone number is required for customer registration';
  END IF;
  
  INSERT INTO public.customer_accounts (user_id, name, phone)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$function$;