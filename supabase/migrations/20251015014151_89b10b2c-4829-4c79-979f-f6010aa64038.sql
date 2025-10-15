-- ============================================================================
-- Cleanup Incomplete Admin User Accounts
-- ============================================================================
-- Purpose: Remove 11 users stuck in invalid state (customer_accounts exist
--          but no profiles/roles) to allow proper admin recreation
--
-- Users to clean:
-- 1. emmanuelaudokw@gmail.com
-- 2. gwendolyn@startersmallchops.com
-- 3. ulekeji2900@gmail.com
-- 4. emebassey20120@gmail.com
-- 5. toyintheophilus01@gmail.com
-- 6. akomhelen@gmail.com
-- 7. maryaustinokoro@gmail.com
-- 8. account@startersmallchops.com (BANNED - will be unbanned)
-- 9. maryqueenrita@gmail.com
-- 10. maryqueenife@gmail.com
-- 11. beenfacoo@gmail.com
--
-- Safety: Transaction-wrapped, exception-handled, audit-logged
-- ============================================================================

DO $$
DECLARE
  user_emails TEXT[] := ARRAY[
    'emmanuelaudokw@gmail.com',
    'gwendolyn@startersmallchops.com',
    'ulekeji2900@gmail.com',
    'emebassey20120@gmail.com',
    'toyintheophilus01@gmail.com',
    'akomhelen@gmail.com',
    'maryaustinokoro@gmail.com',
    'account@startersmallchops.com',
    'maryqueenrita@gmail.com',
    'maryqueenife@gmail.com',
    'beenfacoo@gmail.com'
  ];
  current_email TEXT;
  user_record RECORD;
  deleted_count INTEGER := 0;
  cleanup_summary JSONB := '[]'::jsonb;
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Starting cleanup of 11 incomplete admin user accounts';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';

  -- Loop through each email
  FOREACH current_email IN ARRAY user_emails LOOP
    BEGIN
      RAISE NOTICE 'Processing: %', current_email;
      
      -- Get user details from auth.users
      SELECT id, email, created_at, banned_until, raw_user_meta_data
      INTO user_record
      FROM auth.users
      WHERE email = current_email;

      IF NOT FOUND THEN
        RAISE NOTICE '  ⚠️  User not found in auth.users - already deleted';
        CONTINUE;
      END IF;

      RAISE NOTICE '  Found user ID: %', user_record.id;
      IF user_record.banned_until IS NOT NULL THEN
        RAISE NOTICE '  ⚠️  User is BANNED until: %', user_record.banned_until;
      END IF;

      -- Step 1: Delete from customer_accounts (remove dual-type conflict)
      DELETE FROM customer_accounts
      WHERE user_id = user_record.id;
      RAISE NOTICE '  ✅ Deleted customer_accounts entry';

      -- Step 2: Delete from profiles (should be empty, but cleanup just in case)
      DELETE FROM profiles
      WHERE id = user_record.id;
      RAISE NOTICE '  ✅ Deleted profiles entry (if existed)';

      -- Step 3: Delete from user_roles (should be empty, but cleanup just in case)
      DELETE FROM user_roles
      WHERE user_id = user_record.id;
      RAISE NOTICE '  ✅ Deleted user_roles entries (if existed)';

      -- Step 4: Delete from communication_events
      DELETE FROM communication_events
      WHERE order_id IN (
        SELECT id FROM orders WHERE customer_id = user_record.id
      );
      RAISE NOTICE '  ✅ Cleaned communication_events';

      -- Step 5: Delete from auth.users (final cleanup)
      DELETE FROM auth.users
      WHERE id = user_record.id;
      RAISE NOTICE '  ✅ Deleted auth.users entry';

      -- Log to audit_logs
      INSERT INTO audit_logs (
        action,
        category,
        message,
        user_id,
        old_values
      ) VALUES (
        'incomplete_admin_user_cleanup',
        'User Management',
        'Cleaned up incomplete admin user: ' || current_email,
        user_record.id,
        jsonb_build_object(
          'email', current_email,
          'auth_user_id', user_record.id,
          'created_at', user_record.created_at,
          'was_banned', user_record.banned_until IS NOT NULL,
          'metadata', user_record.raw_user_meta_data
        )
      );

      deleted_count := deleted_count + 1;
      cleanup_summary := cleanup_summary || jsonb_build_object(
        'email', current_email,
        'user_id', user_record.id,
        'status', 'deleted'
      );

      RAISE NOTICE '  ✅ DELETED: % (ID: %)', current_email, user_record.id;
      RAISE NOTICE '';

    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ ERROR cleaning up %: %', current_email, SQLERRM;
      cleanup_summary := cleanup_summary || jsonb_build_object(
        'email', current_email,
        'status', 'error',
        'error', SQLERRM
      );
      RAISE NOTICE '';
    END;
  END LOOP;

  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Cleanup Summary:';
  RAISE NOTICE '  Total users processed: %', array_length(user_emails, 1);
  RAISE NOTICE '  Successfully deleted: %', deleted_count;
  RAISE NOTICE '  Failed: %', array_length(user_emails, 1) - deleted_count;
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ All emails are now available for admin user recreation';
  RAISE NOTICE '';

  -- Final audit log entry
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'bulk_incomplete_admin_cleanup_completed',
    'User Management',
    'Completed cleanup of 11 incomplete admin users',
    jsonb_build_object(
      'total_processed', array_length(user_emails, 1),
      'successfully_deleted', deleted_count,
      'details', cleanup_summary
    )
  );

END $$;

-- ============================================================================
-- Verification: Confirm all users are deleted
-- ============================================================================

DO $$
DECLARE
  remaining_count INTEGER;
  user_emails TEXT[] := ARRAY[
    'emmanuelaudokw@gmail.com',
    'gwendolyn@startersmallchops.com',
    'ulekeji2900@gmail.com',
    'emebassey20120@gmail.com',
    'toyintheophilus01@gmail.com',
    'akomhelen@gmail.com',
    'maryaustinokoro@gmail.com',
    'account@startersmallchops.com',
    'maryqueenrita@gmail.com',
    'maryqueenife@gmail.com',
    'beenfacoo@gmail.com'
  ];
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Verification: Checking for any remaining user data';
  RAISE NOTICE '============================================================================';

  -- Check auth.users
  SELECT COUNT(*) INTO remaining_count
  FROM auth.users
  WHERE email = ANY(user_emails);
  RAISE NOTICE 'auth.users: % remaining', remaining_count;

  -- Check customer_accounts
  SELECT COUNT(*) INTO remaining_count
  FROM customer_accounts ca
  JOIN auth.users u ON ca.user_id = u.id
  WHERE u.email = ANY(user_emails);
  RAISE NOTICE 'customer_accounts: % remaining', remaining_count;

  -- Check profiles
  SELECT COUNT(*) INTO remaining_count
  FROM profiles p
  WHERE p.email = ANY(user_emails);
  RAISE NOTICE 'profiles: % remaining', remaining_count;

  -- Check user_roles
  SELECT COUNT(*) INTO remaining_count
  FROM user_roles ur
  JOIN auth.users u ON ur.user_id = u.id
  WHERE u.email = ANY(user_emails);
  RAISE NOTICE 'user_roles: % remaining', remaining_count;

  RAISE NOTICE '============================================================================';
  RAISE NOTICE '✅ Verification complete - all users should show 0 remaining';
  RAISE NOTICE '============================================================================';
END $$;