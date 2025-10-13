-- Safe data migration to assign roles to existing users without any
-- This migration uses ON CONFLICT (user_id, role) DO NOTHING to prevent duplicates
-- and carefully determines appropriate roles based on email patterns and profile data

DO $$
DECLARE
  v_assigned_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_user RECORD;
  v_role app_role;
BEGIN
  RAISE NOTICE 'Starting role assignment migration for users without roles...';
  
  -- Process users without any active roles
  FOR v_user IN 
    SELECT DISTINCT 
      u.id, 
      u.email, 
      u.raw_user_meta_data,
      u.created_at as user_created_at,
      p.role as profile_role, 
      p.status as profile_status,
      p.name as profile_name
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.is_active = true
    WHERE u.deleted_at IS NULL
      AND ur.id IS NULL  -- No active role exists
    ORDER BY u.created_at DESC
  LOOP
    BEGIN
      v_role := NULL;
      
      -- Determine appropriate role based on multiple criteria
      
      -- 1. Super admin - special email
      IF v_user.email = 'toolbuxdev@gmail.com' THEN
        v_role := 'super_admin';
        
      -- 2. Admin users - specific patterns
      ELSIF v_user.email LIKE '%@startersmallchops.com' 
         OR v_user.email = 'chudesyl@gmail.com'
         OR v_user.profile_role = 'admin'
         OR (v_user.raw_user_meta_data->>'user_type') = 'admin'
         OR (v_user.raw_user_meta_data->>'created_by_admin')::boolean = true
      THEN
        v_role := 'admin';
      
      -- 3. Staff users - have profiles with active status
      ELSIF v_user.profile_role IS NOT NULL 
        AND v_user.profile_status = 'active'
        AND v_user.profile_name IS NOT NULL
      THEN
        v_role := 'staff';
      
      -- 4. Skip customers/guests - they don't need user_roles entries
      ELSE
        v_skipped_count := v_skipped_count + 1;
        RAISE NOTICE 'Skipped user % (customer/guest, no role needed)', v_user.email;
        CONTINUE;
      END IF;
      
      -- Insert role with conflict handling
      INSERT INTO user_roles (user_id, role, is_active, assigned_by, assigned_at, created_at)
      VALUES (v_user.id, v_role, true, v_user.id, NOW(), NOW())
      ON CONFLICT (user_id, role) DO NOTHING;
      
      -- Check if insert was successful (not conflicted)
      IF FOUND THEN
        v_assigned_count := v_assigned_count + 1;
        RAISE NOTICE 'Assigned % role to user % (ID: %)', v_role, v_user.email, v_user.id;
      ELSE
        v_skipped_count := v_skipped_count + 1;
        RAISE NOTICE 'Role already exists for user %', v_user.email;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      RAISE WARNING 'Failed to assign role to user %: %', v_user.email, SQLERRM;
    END;
  END LOOP;
  
  -- Log the migration results
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'system_role_migration_fix',
    'Data Migration',
    'Fixed role assignments for existing users',
    jsonb_build_object(
      'assigned_count', v_assigned_count,
      'skipped_count', v_skipped_count,
      'error_count', v_error_count,
      'migration_date', NOW(),
      'migration_version', '2.0_auth_fix'
    )
  );
  
  RAISE NOTICE 'Migration complete: % roles assigned, % skipped (customers/duplicates), % errors', 
    v_assigned_count, v_skipped_count, v_error_count;
END $$;