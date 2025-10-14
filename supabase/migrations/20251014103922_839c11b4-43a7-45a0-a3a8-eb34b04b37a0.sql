-- ✅ PHASE 1: Restore Admin User Access - Create Missing Profiles and Roles

-- Step 1: Create profiles for all admin users created by super admin who don't have profiles
INSERT INTO profiles (id, name, role, status, created_at, updated_at)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  'admin',
  'active',
  NOW(),
  NOW()
FROM auth.users au
WHERE (au.raw_user_meta_data->>'created_by_admin')::boolean = true
  AND au.id NOT IN (SELECT id FROM profiles)
  AND au.id NOT IN (SELECT user_id FROM customer_accounts)
  AND au.email != 'toolbuxdev@gmail.com';

-- Step 2: Create user_roles for all admin users created by super admin who don't have roles
INSERT INTO user_roles (user_id, role, is_active, assigned_by, created_at, updated_at)
SELECT 
  au.id,
  COALESCE(
    (au.raw_user_meta_data->>'role')::app_role,
    'admin'::app_role
  ),
  true,
  'b29ca05f-71b3-4159-a7e9-f33f45488285', -- toolbuxdev@gmail.com ID
  NOW(),
  NOW()
FROM auth.users au
WHERE (au.raw_user_meta_data->>'created_by_admin')::boolean = true
  AND au.id NOT IN (SELECT user_id FROM user_roles)
  AND au.id NOT IN (SELECT user_id FROM customer_accounts)
  AND au.email != 'toolbuxdev@gmail.com';

-- Step 3: Update prevent_dual_user_types() to allow admin creation for users created by admin
CREATE OR REPLACE FUNCTION prevent_dual_user_types()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email TEXT;
  v_created_by_admin BOOLEAN;
BEGIN
  -- Get user email and metadata for logging
  SELECT email, 
         COALESCE((raw_user_meta_data->>'created_by_admin')::boolean, false)
  INTO v_user_email, v_created_by_admin
  FROM auth.users 
  WHERE id = COALESCE(NEW.id, NEW.user_id);
  
  -- Skip check for toolbuxdev@gmail.com
  IF v_user_email = 'toolbuxdev@gmail.com' THEN
    RETURN NEW;
  END IF;
  
  -- ✅ FIX: Allow admin profile creation if user was created by admin
  IF TG_TABLE_NAME = 'profiles' AND v_created_by_admin THEN
    -- Only block if user ACTUALLY has a customer account (not just metadata)
    IF EXISTS (SELECT 1 FROM customer_accounts WHERE user_id = NEW.id) THEN
      INSERT INTO security_violations (user_id, violation_type, details)
      VALUES (
        NEW.id,
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
    IF EXISTS (SELECT 1 FROM customer_accounts WHERE user_id = NEW.id) THEN
      INSERT INTO security_violations (user_id, violation_type, details)
      VALUES (
        NEW.id,
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
    IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.user_id) THEN
      INSERT INTO security_violations (user_id, violation_type, details)
      VALUES (
        NEW.user_id,
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
$$ LANGUAGE plpgsql;