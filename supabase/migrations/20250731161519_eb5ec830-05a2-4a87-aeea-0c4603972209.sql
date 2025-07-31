-- Fix the phone constraint issue by first updating invalid phone numbers
-- and then applying a more lenient constraint

-- First, update any NULL phone values
UPDATE public.customer_accounts 
SET phone = 'PHONE_REQUIRED' 
WHERE phone IS NULL OR phone = '';

-- Update any obviously invalid phone numbers (too short)
UPDATE public.customer_accounts 
SET phone = 'PHONE_REQUIRED' 
WHERE length(trim(phone)) < 10;

-- Now make the phone field NOT NULL
ALTER TABLE public.customer_accounts 
ALTER COLUMN phone SET NOT NULL;

-- Add a simple constraint that ensures phone is at least 10 characters and not the placeholder
ALTER TABLE public.customer_accounts 
ADD CONSTRAINT phone_not_empty_check 
CHECK (length(trim(phone)) >= 10 AND phone != 'PHONE_REQUIRED' AND phone != 'UPDATE_REQUIRED');

-- Update the trigger function to handle required phone numbers properly
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