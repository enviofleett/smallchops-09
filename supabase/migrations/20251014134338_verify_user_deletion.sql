-- Verification query to check if specified users have been deleted
-- This should return 0 rows if all users were successfully deleted

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
  RAISE NOTICE 'Starting verification of user deletion...';
  RAISE NOTICE '================================================';
  
  FOREACH email IN ARRAY user_emails
  LOOP
    -- Check auth.users
    SELECT COUNT(*) INTO found_in_auth
    FROM auth.users
    WHERE email = email;
    
    -- Check customers
    SELECT COUNT(*) INTO found_in_customers
    FROM customers
    WHERE email = email;
    
    -- Check profiles
    SELECT COUNT(*) INTO found_in_profiles
    FROM profiles
    WHERE email = email;
    
    IF found_in_auth > 0 OR found_in_customers > 0 OR found_in_profiles > 0 THEN
      RAISE NOTICE 'STILL EXISTS: % (auth: %, customers: %, profiles: %)', 
        email, found_in_auth, found_in_customers, found_in_profiles;
      total_found := total_found + 1;
    ELSE
      RAISE NOTICE 'DELETED: %', email;
    END IF;
  END LOOP;
  
  RAISE NOTICE '================================================';
  IF total_found = 0 THEN
    RAISE NOTICE 'SUCCESS: All users have been deleted';
  ELSE
    RAISE WARNING 'INCOMPLETE: % users still found in database', total_found;
  END IF;
END $$;
