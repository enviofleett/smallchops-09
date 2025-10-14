# Quick Start: Delete Users

## 🎯 Goal
Permanently delete 9 specified user accounts from the system.

## ⚡ Quick Apply (Supabase Dashboard)

### Step 1: Delete Users
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste this:

```sql
-- Delete specified users permanently
DO $$
DECLARE
  user_emails TEXT[] := ARRAY[
    'ulekeji2900@gmail.com',
    'emebassey20120@gmail.com',
    'toyintheophilus01@gmail.com',
    'akomhelen@gmail.com',
    'maryaustinokoro@gmail.com',
    'account@startersmallchops.com',
    'emmanuelaudokw@gmail.com',
    'beenfacoo@gmail.com',
    'maryqueenrita@gmail.com'
  ];
  email TEXT;
  v_result JSONB;
BEGIN
  FOREACH email IN ARRAY user_emails
  LOOP
    BEGIN
      SELECT public.recover_customer_email(email) INTO v_result;
      RAISE NOTICE 'Deleted user: % - Result: %', email, v_result;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Error deleting user %: %', email, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'User deletion completed';
END $$;
```

3. Click **Run**
4. Check output for success messages

### Step 2: Verify Deletion
Run this to confirm all users are deleted:

```sql
-- Verification
DO $$
DECLARE
  user_emails TEXT[] := ARRAY[
    'ulekeji2900@gmail.com',
    'emebassey20120@gmail.com',
    'toyintheophilus01@gmail.com',
    'akomhelen@gmail.com',
    'maryaustinokoro@gmail.com',
    'account@startersmallchops.com',
    'emmanuelaudokw@gmail.com',
    'beenfacoo@gmail.com',
    'maryqueenrita@gmail.com'
  ];
  email TEXT;
  found_in_auth INTEGER;
  found_in_customers INTEGER;
  found_in_profiles INTEGER;
  total_found INTEGER := 0;
BEGIN
  RAISE NOTICE 'Verification Report:';
  RAISE NOTICE '==================';
  
  FOREACH email IN ARRAY user_emails
  LOOP
    SELECT COUNT(*) INTO found_in_auth FROM auth.users WHERE email = email;
    SELECT COUNT(*) INTO found_in_customers FROM customers WHERE email = email;
    SELECT COUNT(*) INTO found_in_profiles FROM profiles WHERE email = email;
    
    IF found_in_auth > 0 OR found_in_customers > 0 OR found_in_profiles > 0 THEN
      RAISE NOTICE 'STILL EXISTS: % (auth: %, customers: %, profiles: %)', 
        email, found_in_auth, found_in_customers, found_in_profiles;
      total_found := total_found + 1;
    ELSE
      RAISE NOTICE 'DELETED: %', email;
    END IF;
  END LOOP;
  
  RAISE NOTICE '==================';
  IF total_found = 0 THEN
    RAISE NOTICE '✓ SUCCESS: All users deleted';
  ELSE
    RAISE WARNING '✗ INCOMPLETE: % users remain', total_found;
  END IF;
END $$;
```

## ✅ Expected Results

### After Step 1:
```
NOTICE: Deleted user: ulekeji2900@gmail.com - Result: {"success": true, ...}
NOTICE: Deleted user: emebassey20120@gmail.com - Result: {"success": true, ...}
...
NOTICE: User deletion completed
```

### After Step 2:
```
NOTICE: Verification Report:
NOTICE: ==================
NOTICE: DELETED: ulekeji2900@gmail.com
NOTICE: DELETED: emebassey20120@gmail.com
...
NOTICE: ==================
NOTICE: ✓ SUCCESS: All users deleted
```

## 📚 Full Documentation
- **USER_DELETION_GUIDE.md** - Complete instructions
- **DELETION_SUMMARY.md** - Technical details

## ⚠️ Warning
This deletion is **PERMANENT** and cannot be undone!

## 🔍 Audit Trail
Check deletion logs:
```sql
SELECT * FROM audit_logs 
WHERE action = 'email_recovery_completed' 
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```
