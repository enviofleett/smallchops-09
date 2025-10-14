-- ============================================
-- FIX: Update prevent_dual_user_types trigger to handle both table schemas
-- ============================================

CREATE OR REPLACE FUNCTION public.prevent_dual_user_types()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_email TEXT;
  v_created_by_admin BOOLEAN;
  v_checking_user_id UUID;
BEGIN
  -- Determine the user_id being checked based on which table triggered this
  IF TG_TABLE_NAME = 'profiles' THEN
    v_checking_user_id := NEW.id;  -- profiles uses 'id'
  ELSIF TG_TABLE_NAME = 'customer_accounts' THEN
    v_checking_user_id := NEW.user_id;  -- customer_accounts uses 'user_id'
  ELSE
    RAISE EXCEPTION 'Trigger called from unexpected table: %', TG_TABLE_NAME;
  END IF;
  
  -- Get user email and metadata for logging
  SELECT email, 
         COALESCE((raw_user_meta_data->>'created_by_admin')::boolean, false)
  INTO v_user_email, v_created_by_admin
  FROM auth.users 
  WHERE id = v_checking_user_id;
  
  -- Skip check for toolbuxdev@gmail.com
  IF v_user_email = 'toolbuxdev@gmail.com' THEN
    RETURN NEW;
  END IF;
  
  -- ✅ FIX: Allow admin profile creation if user was created by admin
  IF TG_TABLE_NAME = 'profiles' AND v_created_by_admin THEN
    -- Only block if user ACTUALLY has a customer account (not just metadata)
    IF EXISTS (SELECT 1 FROM customer_accounts WHERE user_id = v_checking_user_id) THEN
      INSERT INTO security_violations (user_id, violation_type, details)
      VALUES (
        v_checking_user_id,
        'attempted_admin_profile_on_customer',
        jsonb_build_object(
          'email', v_user_email,
          'attempted_role', NEW.role,
          'blocked_at', NOW()
        )
      );
      
      RAISE EXCEPTION 'Security violation: User % already has a customer account and cannot have an admin profile', v_user_email;
    END IF;
    -- Allow profile creation for admin users
    RETURN NEW;
  END IF;
  
  -- Prevent creating profile if customer account exists (for non-admin users)
  IF TG_TABLE_NAME = 'profiles' THEN
    IF EXISTS (SELECT 1 FROM customer_accounts WHERE user_id = v_checking_user_id) THEN
      INSERT INTO security_violations (user_id, violation_type, details)
      VALUES (
        v_checking_user_id,
        'attempted_admin_profile_on_customer',
        jsonb_build_object(
          'email', v_user_email,
          'attempted_role', NEW.role,
          'blocked_at', NOW()
        )
      );
      
      RAISE EXCEPTION 'Security violation: User % already has a customer account and cannot have an admin profile', v_user_email;
    END IF;
  END IF;
  
  -- Prevent creating customer account if profile exists
  IF TG_TABLE_NAME = 'customer_accounts' THEN
    IF EXISTS (SELECT 1 FROM profiles WHERE id = v_checking_user_id) THEN
      INSERT INTO security_violations (user_id, violation_type, details)
      VALUES (
        v_checking_user_id,
        'attempted_customer_account_on_admin',
        jsonb_build_object(
          'email', v_user_email,
          'blocked_at', NOW()
        )
      );
      
      RAISE EXCEPTION 'Security violation: User % already has an admin profile and cannot have a customer account', v_user_email;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;