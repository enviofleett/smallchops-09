-- Delete specified users permanently
-- This migration will remove all data for the following users:
-- 'ulekeji2900@gmail.com', 'emebassey20120@gmail.com', 'toyintheophilus01@gmail.com', 
-- 'akomhelen@gmail.com', 'maryaustinokoro@gmail.com', 'account@startersmallchops.com',
-- 'emmanuelaudokw@gmail.com', 'beenfacoo@gmail.com', 'maryqueenrita@gmail.com'

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
  -- Loop through each email and use the recover_customer_email function to delete them
  FOREACH email IN ARRAY user_emails
  LOOP
    BEGIN
      -- Use the existing recover_customer_email function that handles comprehensive cleanup
      SELECT public.recover_customer_email(email) INTO v_result;
      
      RAISE NOTICE 'Deleted user: % - Result: %', email, v_result;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Error deleting user %: %', email, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'User deletion completed';
END $$;
