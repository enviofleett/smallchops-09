-- ============================================
-- PRODUCTION FIX: Convert toolbuxdev@gmail.com to Super Admin
-- ============================================

DO $$ 
DECLARE
  v_user_id UUID := 'b29ca05f-71b3-4159-a7e9-f33f45488285';
  v_customer_account_id UUID := '0e9ddaa2-d0c6-43aa-bd6d-bcd214ca41cd';
  v_email TEXT := 'toolbuxdev@gmail.com';
  v_deleted_cart_sessions_count INTEGER;
BEGIN
  -- Step 1: Remove cart_sessions that reference this customer account
  DELETE FROM cart_sessions 
  WHERE customer_id = v_customer_account_id;
  
  GET DIAGNOSTICS v_deleted_cart_sessions_count = ROW_COUNT;
  RAISE NOTICE '✅ Deleted % cart sessions', v_deleted_cart_sessions_count;
  
  -- Step 2: Remove customer account
  DELETE FROM customer_accounts 
  WHERE user_id = v_user_id;
  
  RAISE NOTICE '✅ Deleted customer account';
  
  -- Step 3: Create admin profile
  INSERT INTO profiles (id, name, email, role, status, is_active, created_at, updated_at)
  VALUES (
    v_user_id,
    'Chinedu Victor',
    v_email,
    'admin',
    'active',
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
  
  RAISE NOTICE '✅ Created admin profile';
  
  -- Step 4: Assign super_admin role
  INSERT INTO user_roles (user_id, role, is_active, assigned_by, created_at, updated_at)
  VALUES (
    v_user_id,
    'super_admin',
    true,
    v_user_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, role) DO UPDATE SET
    is_active = true,
    updated_at = NOW();
  
  RAISE NOTICE '✅ Assigned super_admin role';
  
  -- Step 5: Log conversion
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
  VALUES (
    'customer_to_superadmin_conversion',
    'Security',
    'Production login fix: Converted customer to super admin',
    v_user_id,
    v_user_id,
    jsonb_build_object(
      'email', v_email,
      'previous_type', 'customer',
      'new_type', 'super_admin',
      'cart_sessions_deleted', v_deleted_cart_sessions_count,
      'timestamp', NOW()
    )
  );
  
  RAISE NOTICE '✅ Conversion complete';
  
END $$;

-- Verification
SELECT 
  au.email,
  CASE WHEN p.id IS NOT NULL THEN '✅ PROFILE' ELSE '❌ NO PROFILE' END as profile,
  p.role as profile_role,
  ur.role as user_role,
  CASE WHEN ca.id IS NOT NULL THEN '❌ STILL CUSTOMER' ELSE '✅ NOT CUSTOMER' END as customer_check
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
LEFT JOIN user_roles ur ON au.id = ur.user_id AND ur.is_active = true
LEFT JOIN customer_accounts ca ON au.id = ca.user_id
WHERE au.email = 'toolbuxdev@gmail.com';