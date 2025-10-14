-- Migration: Restore orphaned admin users with profiles and user_roles
-- Addresses issue where admin users exist in auth.users but lack profiles/user_roles entries

DO $$ 
DECLARE
  v_user RECORD;
  v_role app_role;
  v_name text;
  v_restored_count integer := 0;
BEGIN
  RAISE NOTICE 'Starting orphaned admin user restoration...';
  
  -- Loop through all orphaned admin users
  FOR v_user IN 
    SELECT 
      au.id,
      au.email,
      au.raw_user_meta_data->>'role' as metadata_role,
      au.raw_user_meta_data->>'name' as metadata_name,
      au.created_at
    FROM auth.users au
    WHERE (au.raw_user_meta_data->>'created_by_admin')::boolean = true
      AND au.id NOT IN (SELECT id FROM profiles)
      AND au.id NOT IN (SELECT user_id FROM customer_accounts)
    ORDER BY au.created_at ASC
  LOOP
    RAISE NOTICE 'Processing orphaned admin user: % (ID: %)', v_user.email, v_user.id;
    
    -- Determine role from metadata or default to support_staff
    BEGIN
      v_role := COALESCE(v_user.metadata_role::app_role, 'support_staff'::app_role);
    EXCEPTION WHEN OTHERS THEN
      v_role := 'support_staff'::app_role;
      RAISE NOTICE 'Invalid role in metadata for %, defaulting to support_staff', v_user.email;
    END;
    
    -- Determine name from metadata or email
    v_name := COALESCE(v_user.metadata_name, split_part(v_user.email, '@', 1));
    
    -- Create profile entry
    INSERT INTO profiles (id, name, email, role, status, is_active, created_at, updated_at)
    VALUES (
      v_user.id,
      v_name,
      v_user.email,
      'admin', -- Generic admin role for profile table
      'active',
      true,
      v_user.created_at,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Create user_role entry with specific role
    INSERT INTO user_roles (user_id, role, is_active, assigned_by, created_at, updated_at)
    VALUES (
      v_user.id,
      v_role,
      true,
      'b29ca05f-71b3-4159-a7e9-f33f45488285', -- toolbuxdev@gmail.com as assigner
      v_user.created_at,
      NOW()
    )
    ON CONFLICT (user_id, role) DO UPDATE 
    SET is_active = true, updated_at = NOW();
    
    -- Log to audit_logs
    INSERT INTO audit_logs (action, category, message, entity_id, new_values)
    VALUES (
      'orphaned_admin_restored',
      'User Management',
      'Restored orphaned admin user: ' || v_user.email,
      v_user.id,
      jsonb_build_object(
        'email', v_user.email,
        'role', v_role,
        'name', v_name
      )
    );
    
    v_restored_count := v_restored_count + 1;
    RAISE NOTICE 'Successfully restored % with role %', v_user.email, v_role;
  END LOOP;
  
  RAISE NOTICE 'Restoration complete. Total users restored: %', v_restored_count;
END $$;

-- Verification: Check all restored users
DO $$
DECLARE
  v_result RECORD;
BEGIN
  RAISE NOTICE '=== VERIFICATION REPORT ===';
  
  FOR v_result IN
    SELECT 
      au.email,
      p.name,
      p.role as profile_role,
      ur.role as user_role,
      ur.is_active
    FROM auth.users au
    JOIN profiles p ON au.id = p.id
    JOIN user_roles ur ON au.id = ur.user_id
    WHERE (au.raw_user_meta_data->>'created_by_admin')::boolean = true
      AND au.email IN (
        'babatee00@gmail.com', 'mercyaganabaa@gmail.com', 'maryqueenrita@gmail.com',
        'maryqueenife@gmail.com', 'beenfacoo@gmail.com', 'gwen@startersmallchops.com',
        'emmanuelaudokw@gmail.com', 'gwendolyn@startersmallchops.com', 'ulekeji2900@gmail.com',
        'emebassey20120@gmail.com', 'toyintheophilus01@gmail.com', 'akomhelen@gmail.com',
        'maryaustinokoro@gmail.com', 'account@startersmallchops.com', 'enviofleet+1@gmail.com'
      )
    ORDER BY au.email
  LOOP
    RAISE NOTICE 'User: % | Name: % | Profile Role: % | User Role: % | Active: %', 
      v_result.email, v_result.name, v_result.profile_role, v_result.user_role, v_result.is_active;
  END LOOP;
END $$;