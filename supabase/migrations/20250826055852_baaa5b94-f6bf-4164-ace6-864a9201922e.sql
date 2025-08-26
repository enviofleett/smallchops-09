-- Fix the is_email_suppressed function column reference
CREATE OR REPLACE FUNCTION public.is_email_suppressed(email_address text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check suppression list
  IF EXISTS (
    SELECT 1 FROM email_suppression_list 
    WHERE email = LOWER(email_address) 
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;
  
  -- Check bounce tracking
  IF EXISTS (
    SELECT 1 FROM email_bounce_tracking 
    WHERE email_address = LOWER(email_address)
    AND bounce_type = 'hard'
    AND suppressed_at IS NOT NULL
  ) THEN
    RETURN true;
  END IF;
  
  -- Check unsubscribes
  IF EXISTS (
    SELECT 1 FROM email_unsubscribes 
    WHERE email = LOWER(email_address)
    AND unsubscribed_at IS NOT NULL
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$function$;