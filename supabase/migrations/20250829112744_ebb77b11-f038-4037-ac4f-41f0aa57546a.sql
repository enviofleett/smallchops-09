-- FINAL elimination of SECURITY DEFINER view errors
-- Remove the last 2 problematic SECURITY DEFINER table functions

-- Drop the old SECURITY DEFINER versions (we already have non-SECURITY DEFINER versions)
DROP FUNCTION IF EXISTS public.get_available_delivery_slots(p_start_date date, p_end_date date);
DROP FUNCTION IF EXISTS public.get_orders_with_payment(p_order_id uuid, p_customer_email text);

-- Keep get_active_paystack_config with SECURITY DEFINER but ensure it has strict access control
-- Update it to include proper admin verification and audit logging
CREATE OR REPLACE FUNCTION public.get_active_paystack_config()
RETURNS TABLE(public_key text, test_mode boolean, secret_key text, webhook_secret text, environment text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- CRITICAL: This function MUST keep SECURITY DEFINER for payment security
  -- but we add strict admin-only access control
  
  IF NOT is_admin() THEN
    -- Log unauthorized access attempt
    INSERT INTO audit_logs (
      action, category, message, user_id
    ) VALUES (
      'unauthorized_paystack_config_access',
      'Security Violation',
      'Unauthorized attempt to access Paystack configuration',
      auth.uid()
    );
    
    RAISE EXCEPTION 'Access denied: Admin privileges required for payment configuration access';
  END IF;
  
  -- Log authorized access for audit
  INSERT INTO audit_logs (
    action, category, message, user_id
  ) VALUES (
    'paystack_config_accessed',
    'Payment Security',
    'Admin accessed Paystack configuration',
    auth.uid()
  );
  
  RETURN QUERY
  SELECT 
    CASE 
      WHEN psc.test_mode THEN psc.test_public_key 
      ELSE psc.live_public_key 
    END as public_key,
    psc.test_mode,
    CASE 
      WHEN psc.test_mode THEN psc.test_secret_key 
      ELSE psc.live_secret_key 
    END as secret_key,
    psc.webhook_secret,
    CASE 
      WHEN psc.test_mode THEN 'test' 
      ELSE 'live' 
    END as environment
  FROM paystack_secure_config psc
  WHERE psc.is_active = true
  ORDER BY psc.updated_at DESC
  LIMIT 1;
END;
$function$;

-- This should now reduce SECURITY DEFINER view errors to just 1 (the essential payment config function)
-- All other table functions now use proper RLS policies instead of SECURITY DEFINER