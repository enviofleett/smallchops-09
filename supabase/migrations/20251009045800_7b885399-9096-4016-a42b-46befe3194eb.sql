-- =====================================================
-- PRODUCTION FIX: Admin User & Permission System Audit
-- =====================================================
-- This migration fixes critical issues found in admin user logic:
-- 1. Missing trigger for automatic permission assignment
-- 2. Legacy is_admin() function with incorrect logic
-- 3. Incomplete role permission mappings
-- 4. Backfills permissions for 6 orphaned admin users

-- =====================================================
-- STEP 1: Update is_admin() function (Remove Legacy Check)
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Special case for super admin email
  SELECT CASE 
    WHEN (SELECT email FROM auth.users WHERE id = auth.uid()) = 'toolbuxdev@gmail.com' THEN true
    -- Check if user has any active admin role in user_roles table
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
    )
  END
$$;

-- =====================================================
-- STEP 2: Update setup_admin_role_permissions (Complete All Roles)
-- =====================================================
CREATE OR REPLACE FUNCTION public.setup_admin_role_permissions(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete existing permissions
  DELETE FROM user_permissions WHERE user_id = p_user_id;
  
  -- Insert permissions based on role
  IF p_role IN ('super_admin', 'store_owner') THEN
    -- Full access to everything
    INSERT INTO user_permissions (user_id, menu_key, permission_level)
    SELECT p_user_id, unnest(ARRAY[
      'dashboard','orders_view','categories_view','products_view','customers_view',
      'catering_bookings','delivery_zones','promotions_view','reports-sales','audit_logs','settings',
      'settings_admin_users','settings_admin_permissions','settings_payments_providers',
      'settings_communications_branding','settings_dev'
    ]), 'edit';
  
  ELSIF p_role IN ('admin', 'manager') THEN
    -- Admin/Manager: Most features except dev settings
    INSERT INTO user_permissions (user_id, menu_key, permission_level)
    SELECT p_user_id, unnest(ARRAY[
      'dashboard','orders_view','categories_view','products_view','customers_view',
      'catering_bookings','delivery_zones','promotions_view','reports-sales','settings',
      'settings_payments_providers','settings_communications_branding'
    ]), 'edit';
  
  ELSIF p_role IN ('support_staff', 'support_officer', 'staff') THEN
    -- Support staff: Orders and customers only
    INSERT INTO user_permissions (user_id, menu_key, permission_level)
    VALUES 
      (p_user_id, 'dashboard', 'view'),
      (p_user_id, 'orders_view', 'edit'),
      (p_user_id, 'customers_view', 'edit');
  
  ELSIF p_role = 'admin_manager' THEN
    -- Admin manager: Product and promotion management
    INSERT INTO user_permissions (user_id, menu_key, permission_level)
    SELECT p_user_id, unnest(ARRAY[
      'dashboard','products_view','categories_view','catering_bookings',
      'delivery_zones','promotions_view'
    ]), 'edit';
  
  ELSIF p_role = 'account_manager' THEN
    -- Account manager: Financial oversight
    INSERT INTO user_permissions (user_id, menu_key, permission_level)
    SELECT p_user_id, unnest(ARRAY[
      'dashboard','orders_view','reports-sales'
    ]), 'edit';
  END IF;
  
  -- Log the permission assignment
  INSERT INTO audit_logs (action, category, message, user_id, entity_id, new_values)
  VALUES (
    'permissions_auto_assigned',
    'Permission Management',
    'Permissions auto-assigned for role: ' || p_role || ' (Production Fix)',
    p_user_id,
    p_user_id,
    jsonb_build_object('role', p_role, 'timestamp', now(), 'source', 'production_fix_migration')
  );
END;
$$;

-- =====================================================
-- STEP 3: Create Missing Trigger Function
-- =====================================================
CREATE OR REPLACE FUNCTION public.trigger_setup_permissions_on_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only setup permissions when role is active
  IF NEW.is_active = true THEN
    PERFORM setup_admin_role_permissions(NEW.user_id, NEW.role::text);
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================
-- STEP 4: Create Trigger on user_roles Table
-- =====================================================
DROP TRIGGER IF EXISTS on_user_role_change ON public.user_roles;

CREATE TRIGGER on_user_role_change
  AFTER INSERT OR UPDATE OF role, is_active
  ON public.user_roles
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.trigger_setup_permissions_on_role_change();

-- =====================================================
-- STEP 5: Backfill Permissions for Orphaned Admin Users
-- =====================================================
DO $$
DECLARE
  orphan_record RECORD;
  backfill_count INTEGER := 0;
BEGIN
  -- Find all users with roles but no permissions
  FOR orphan_record IN
    SELECT DISTINCT ur.user_id, ur.role
    FROM user_roles ur
    WHERE ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
      AND NOT EXISTS (
        SELECT 1 FROM user_permissions up WHERE up.user_id = ur.user_id
      )
  LOOP
    -- Setup permissions for this orphaned user
    PERFORM setup_admin_role_permissions(orphan_record.user_id, orphan_record.role::text);
    backfill_count := backfill_count + 1;
    
    RAISE NOTICE 'Backfilled permissions for user % with role %', orphan_record.user_id, orphan_record.role;
  END LOOP;
  
  -- Log the backfill operation
  INSERT INTO audit_logs (action, category, message, new_values)
  VALUES (
    'permissions_backfill_completed',
    'System Maintenance',
    'Production fix: Backfilled permissions for ' || backfill_count || ' orphaned admin users',
    jsonb_build_object(
      'backfill_count', backfill_count,
      'timestamp', now(),
      'migration', 'admin_user_logic_production_fix'
    )
  );
  
  RAISE NOTICE 'Backfill completed: % users processed', backfill_count;
END $$;

-- =====================================================
-- STEP 6: Final Audit Log Entry
-- =====================================================
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'admin_system_production_fix_completed',
  'System Maintenance',
  'Admin user logic production fixes applied successfully',
  jsonb_build_object(
    'fixes_applied', jsonb_build_array(
      'Updated is_admin() function to remove legacy checks',
      'Created missing trigger_setup_permissions_on_role_change function',
      'Created trigger on user_roles table for automatic permission assignment',
      'Updated setup_admin_role_permissions with complete role mappings',
      'Backfilled permissions for orphaned admin users'
    ),
    'timestamp', now(),
    'migration_version', 'v1.0_admin_audit_fix'
  )
);