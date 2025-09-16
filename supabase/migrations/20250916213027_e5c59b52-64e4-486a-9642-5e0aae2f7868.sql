-- Update SMS service edge function to handle balance checking
-- Add balance checking functionality to MySMSTab integration

-- First, let's add a function to safely parse MySMSTab balance responses
CREATE OR REPLACE FUNCTION public.log_sms_balance_check(
  p_balance_amount NUMERIC DEFAULT NULL,
  p_provider_response JSONB DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'sms_balance_check',
    'SMS Service',
    CASE 
      WHEN p_status = 'success' THEN 'SMS balance checked successfully: ₦' || COALESCE(p_balance_amount, 0)::text
      ELSE 'SMS balance check failed: ' || COALESCE(p_error_message, 'Unknown error')
    END,
    jsonb_build_object(
      'balance_amount', p_balance_amount,
      'provider_response', p_provider_response,
      'status', p_status,
      'error_message', p_error_message,
      'timestamp', now()
    )
  );
END;
$function$;