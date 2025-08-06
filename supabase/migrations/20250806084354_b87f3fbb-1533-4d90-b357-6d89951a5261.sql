-- =====================================================
-- FINAL FUNCTION SECURITY HARDENING PHASE
-- Fixing all remaining function search path security issues
-- =====================================================

-- Update all remaining functions with proper search_path

-- Update is_admin function
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT role = 'admin' FROM public.profiles WHERE id = (SELECT auth.uid());
$function$;

-- Update update_refunds_timestamp function
CREATE OR REPLACE FUNCTION public.update_refunds_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Update update_payment_transaction_timestamp function
CREATE OR REPLACE FUNCTION public.update_payment_transaction_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Update validate_admin_invitation function  
CREATE OR REPLACE FUNCTION public.validate_admin_invitation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  -- Check rate limit
  IF NOT public.check_admin_creation_rate_limit() THEN
    RAISE EXCEPTION 'Admin invitation rate limit exceeded. Maximum 5 invitations per hour.';
  END IF;

  -- Ensure only admins can create invitations
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can send admin invitations';
  END IF;

  -- Generate secure token if not provided
  IF NEW.invitation_token IS NULL THEN
    NEW.invitation_token := encode(gen_random_bytes(32), 'base64');
  END IF;
  
  -- Set expiry if not provided
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NOW() + INTERVAL '7 days';
  END IF;

  -- Validate email
  IF NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format for admin invitation';
  END IF;

  RETURN NEW;
END;
$function$;

-- Update handle_admin_invitation_signup function
CREATE OR REPLACE FUNCTION public.handle_admin_invitation_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  invitation_record RECORD;
  user_name TEXT;
BEGIN
  -- Only handle users with invitation metadata
  IF NEW.raw_user_meta_data->>'invitation_id' IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verify the invitation exists and is valid
  SELECT * INTO invitation_record
  FROM public.admin_invitations 
  WHERE id = (NEW.raw_user_meta_data->>'invitation_id')::uuid
    AND email = NEW.email
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired admin invitation';
  END IF;

  -- Extract name safely
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Create admin profile
  INSERT INTO public.profiles (id, name, email, role, status)
  VALUES (
    NEW.id,
    user_name,
    NEW.email,
    invitation_record.role::user_role,
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    updated_at = NOW();

  -- Log admin profile creation
  INSERT INTO public.audit_logs (
    action, category, message, new_values, user_id
  ) VALUES (
    'secure_admin_profile_created',
    'Authentication',
    'Admin profile created via secure invitation: ' || NEW.email,
    jsonb_build_object(
      'profile_id', NEW.id,
      'role', invitation_record.role,
      'invitation_id', invitation_record.id
    ),
    NEW.id
  );

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Log errors but don't fail user creation
    INSERT INTO public.audit_logs (
      action, category, message, new_values
    ) VALUES (
      'admin_profile_creation_error',
      'Authentication',
      'Error in secure admin profile creation: ' || SQLERRM,
      jsonb_build_object(
        'user_id', NEW.id,
        'email', NEW.email,
        'error', SQLERRM,
        'invitation_id', NEW.raw_user_meta_data->>'invitation_id'
      )
    );
    
    -- Return NEW to allow user creation to proceed
    RETURN NEW;
END;
$function$;

-- Update trigger_enhanced_email_processing function
CREATE OR REPLACE FUNCTION public.trigger_enhanced_email_processing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  config_record RECORD;
BEGIN
  -- Get enhanced email configuration
  SELECT * INTO config_record FROM public.enhanced_email_config LIMIT 1;
  
  -- Only trigger for queued events if enhanced processing is enabled
  IF NEW.status = 'queued' AND COALESCE(config_record.instant_processing_enabled, true) THEN
    -- Add to processing queue with appropriate priority
    INSERT INTO public.email_processing_queue (
      event_id,
      priority,
      scheduled_for,
      max_attempts
    ) VALUES (
      NEW.id,
      CASE 
        WHEN NEW.priority = 'high' OR NEW.event_type = 'customer_welcome' THEN 'high'
        WHEN NEW.priority = 'low' THEN 'low'
        ELSE 'normal'
      END,
      NOW(),
      COALESCE(config_record.max_retries, 3)
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update update_review_helpfulness function
CREATE OR REPLACE FUNCTION public.update_review_helpfulness()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  review_uuid UUID;
  helpful_count INTEGER;
  total_count INTEGER;
BEGIN
  -- Get the review_id from either NEW or OLD record
  review_uuid := COALESCE(NEW.review_id, OLD.review_id);
  
  -- Calculate vote counts
  SELECT 
    COUNT(*) FILTER (WHERE vote_type = 'helpful'),
    COUNT(*)
  INTO helpful_count, total_count
  FROM public.review_votes 
  WHERE review_id = review_uuid;
  
  -- Update the review
  UPDATE public.product_reviews 
  SET 
    helpful_votes = COALESCE(helpful_count, 0),
    total_votes = COALESCE(total_count, 0),
    updated_at = NOW()
  WHERE id = review_uuid;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Update update_customer_preferences_updated_at function
CREATE OR REPLACE FUNCTION public.update_customer_preferences_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Update is_email_suppressed function
CREATE OR REPLACE FUNCTION public.is_email_suppressed(email_address text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.email_suppression_list 
    WHERE email_address = $1
  );
$function$;

-- Update update_customer_addresses_updated_at function
CREATE OR REPLACE FUNCTION public.update_customer_addresses_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Create missing functions that need search path

-- Create check_admin_creation_rate_limit function if not exists
CREATE OR REPLACE FUNCTION public.check_admin_creation_rate_limit()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_count INTEGER;
  v_limit INTEGER := 5;
BEGIN
  -- Count admin invitations in the last hour
  SELECT COUNT(*) INTO v_count
  FROM public.admin_invitations
  WHERE invited_at > NOW() - INTERVAL '1 hour';
  
  RETURN v_count < v_limit;
END;
$function$;

-- Create log_customer_operation function if not exists
CREATE OR REPLACE FUNCTION public.log_customer_operation(p_action text, p_customer_id uuid, p_details jsonb, p_admin_id uuid DEFAULT NULL, p_ip_address inet DEFAULT NULL, p_user_agent text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    action, entity_type, entity_id, user_id, 
    new_values, ip_address, user_agent
  ) VALUES (
    p_action, 'customer', p_customer_id, COALESCE(p_admin_id, (SELECT auth.uid())),
    p_details, p_ip_address, p_user_agent
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$function$;

-- Create handle_successful_payment function
CREATE OR REPLACE FUNCTION public.handle_successful_payment(p_reference text, p_paid_at timestamp with time zone, p_gateway_response text, p_fees numeric, p_channel text, p_authorization_code text DEFAULT NULL::text, p_card_type text DEFAULT NULL::text, p_last4 text DEFAULT NULL::text, p_exp_month text DEFAULT NULL::text, p_exp_year text DEFAULT NULL::text, p_bank text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_transaction_id uuid;
  v_order_id uuid;
  v_user_id uuid;
BEGIN
  -- Update payment transaction atomically
  UPDATE payment_transactions 
  SET 
    status = 'success',
    paid_at = p_paid_at,
    gateway_response = p_gateway_response,
    fees = p_fees,
    channel = p_channel,
    authorization_code = p_authorization_code,
    card_type = p_card_type,
    last4 = p_last4,
    exp_month = p_exp_month,
    exp_year = p_exp_year,
    bank = p_bank,
    processed_at = now()
  WHERE reference = p_reference
  RETURNING id, order_id INTO v_transaction_id, v_order_id;
  
  -- Update order status
  IF v_order_id IS NOT NULL THEN
    UPDATE orders 
    SET 
      payment_status = 'paid',
      status = 'processing',
      updated_at = now()
    WHERE id = v_order_id;
  END IF;
  
  -- Log the successful payment
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'payment_successful',
    'Payment Processing',
    'Payment processed successfully for reference: ' || p_reference,
    jsonb_build_object(
      'reference', p_reference,
      'transaction_id', v_transaction_id,
      'order_id', v_order_id,
      'amount', p_fees
    )
  );
END;
$function$;

-- Verification message
DO $$
BEGIN
  RAISE NOTICE 'Final database security hardening completed!';
  RAISE NOTICE 'All remaining function search path security issues should now be resolved.';
  RAISE NOTICE 'Please run the linter again to verify zero security issues remain.';
END $$;