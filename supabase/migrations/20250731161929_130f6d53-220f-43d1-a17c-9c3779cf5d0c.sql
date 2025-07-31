-- Fix security warning: Set search_path for functions that don't have it
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