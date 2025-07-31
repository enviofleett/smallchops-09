-- Phase 1: Make phone field NOT NULL in customer_accounts table
-- First, let's add a default value for existing records that might have NULL phone numbers
UPDATE public.customer_accounts 
SET phone = 'UPDATE_REQUIRED' 
WHERE phone IS NULL;

-- Now make the phone field NOT NULL
ALTER TABLE public.customer_accounts 
ALTER COLUMN phone SET NOT NULL;

-- Add a check constraint to ensure phone numbers are valid format
ALTER TABLE public.customer_accounts 
ADD CONSTRAINT phone_format_check 
CHECK (phone ~ '^[\+]?[0-9\-\(\)\s]+$' AND length(trim(phone)) >= 10);

-- Update the trigger function to properly handle phone numbers
CREATE OR REPLACE FUNCTION public.handle_new_customer_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create customer_accounts record when user signs up via auth
  -- Ensure phone number is provided from user metadata
  INSERT INTO public.customer_accounts (user_id, name, phone)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'phone', 'PHONE_REQUIRED')
  );
  RETURN NEW;
END;
$function$;