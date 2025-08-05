-- Update customer_accounts to populate email from auth.users
UPDATE customer_accounts 
SET email = u.email, updated_at = NOW()
FROM auth.users u 
WHERE customer_accounts.user_id = u.id 
  AND customer_accounts.email IS NULL;