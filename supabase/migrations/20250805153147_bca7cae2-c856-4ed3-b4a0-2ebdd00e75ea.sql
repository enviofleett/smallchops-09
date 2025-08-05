-- Create a view to properly link orders with customer_accounts
-- First, let's check if there are matching customers in the legacy customers table for each customer_account
DO $$
DECLARE
    ca_record RECORD;
    customer_record RECORD;
BEGIN
    -- For each customer_account, try to find matching customer in customers table by email
    FOR ca_record IN SELECT id, email, name FROM customer_accounts WHERE email IS NOT NULL LOOP
        -- Look for matching customer in customers table
        SELECT * INTO customer_record FROM customers WHERE email = ca_record.email LIMIT 1;
        
        IF FOUND THEN
            -- Update orders to link to customer_account.id instead of customers.id
            -- We need to temporarily disable the foreign key constraint
            RAISE NOTICE 'Found matching customer for %: % -> %', ca_record.email, customer_record.id, ca_record.id;
        ELSE
            RAISE NOTICE 'No matching customer found for account %', ca_record.email;
        END IF;
    END LOOP;
END $$;