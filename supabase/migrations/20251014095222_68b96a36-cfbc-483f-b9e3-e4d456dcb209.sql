-- =====================================================
-- CRITICAL SECURITY FIX: Remove Invalid Admin Privileges from Customers
-- =====================================================

-- Step 1: Create security violations tracking table
CREATE TABLE IF NOT EXISTS security_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL,
  details JSONB,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE security_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view security violations"
  ON security_violations
  FOR SELECT
  USING (is_admin());

-- Step 2: Remove profiles for users who have customer accounts (except toolbuxdev@gmail.com)
DELETE FROM profiles
WHERE id IN (
  SELECT ca.user_id 
  FROM customer_accounts ca
  WHERE ca.user_id IS NOT NULL
)
AND id NOT IN (
  SELECT id FROM auth.users WHERE email = 'toolbuxdev@gmail.com'
);

-- Step 3: Remove user_roles for users who have customer accounts (except toolbuxdev@gmail.com)
DELETE FROM user_roles
WHERE user_id IN (
  SELECT ca.user_id 
  FROM customer_accounts ca
  WHERE ca.user_id IS NOT NULL
)
AND user_id NOT IN (
  SELECT id FROM auth.users WHERE email = 'toolbuxdev@gmail.com'
);

-- Step 4: Create function to enforce mutual exclusivity between admin and customer accounts
CREATE OR REPLACE FUNCTION prevent_dual_user_types()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  -- Get user email for logging
  SELECT email INTO v_user_email FROM auth.users WHERE id = COALESCE(NEW.id, NEW.user_id);
  
  -- Skip check for toolbuxdev@gmail.com
  IF v_user_email = 'toolbuxdev@gmail.com' THEN
    RETURN NEW;
  END IF;
  
  -- Prevent creating profile if customer account exists
  IF TG_TABLE_NAME = 'profiles' THEN
    IF EXISTS (SELECT 1 FROM customer_accounts WHERE user_id = NEW.id) THEN
      -- Log security violation
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
      -- Log security violation
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

-- Step 5: Apply triggers to enforce constraints
DROP TRIGGER IF EXISTS enforce_single_user_type_profiles ON profiles;
CREATE TRIGGER enforce_single_user_type_profiles
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_dual_user_types();

DROP TRIGGER IF EXISTS enforce_single_user_type_customers ON customer_accounts;
CREATE TRIGGER enforce_single_user_type_customers
  BEFORE INSERT OR UPDATE ON customer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_dual_user_types();

-- Step 6: Create audit function to track violations
CREATE OR REPLACE FUNCTION log_privilege_escalation_attempt(
  p_user_id UUID,
  p_email TEXT,
  p_violation_type TEXT,
  p_details JSONB
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO security_violations (user_id, violation_type, details)
  VALUES (
    p_user_id,
    p_violation_type,
    jsonb_build_object(
      'email', p_email,
      'details', p_details,
      'timestamp', NOW()
    )
  );
  
  -- Also log to audit_logs for comprehensive tracking
  INSERT INTO audit_logs (action, category, message, user_id, new_values)
  VALUES (
    'security_violation_detected',
    'Security',
    'Privilege escalation attempt blocked for ' || p_email,
    p_user_id,
    jsonb_build_object(
      'violation_type', p_violation_type,
      'details', p_details
    )
  );
END;
$$ LANGUAGE plpgsql;