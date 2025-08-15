-- Phase 1: Fix Email Verification Flow - Create sync trigger and fix historical data

-- Function to sync email verification status from Supabase auth
CREATE OR REPLACE FUNCTION sync_customer_email_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- Update customer_accounts when auth.users email is confirmed
  UPDATE customer_accounts 
  SET 
    email_verified = (NEW.email_confirmed_at IS NOT NULL),
    updated_at = NOW()
  WHERE user_id = NEW.id;
  
  -- If no customer_account exists, create one
  IF NOT FOUND AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO customer_accounts (
      user_id, 
      email, 
      name, 
      email_verified, 
      created_at, 
      updated_at
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
      true,
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users
DROP TRIGGER IF EXISTS trigger_sync_customer_verification ON auth.users;
CREATE TRIGGER trigger_sync_customer_verification
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
  EXECUTE FUNCTION sync_customer_email_verification();

-- Function to trigger welcome email after verification
CREATE OR REPLACE FUNCTION trigger_welcome_email_on_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for new verifications
  IF OLD.email_verified = false AND NEW.email_verified = true THEN
    INSERT INTO communication_events (
      event_type,
      recipient_email,
      template_key,
      status,
      variables,
      created_at
    ) VALUES (
      'customer_welcome',
      NEW.email,
      'customer_welcome',
      'queued',
      jsonb_build_object(
        'customer_name', NEW.name,
        'customer_email', NEW.email
      ),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create welcome email trigger
DROP TRIGGER IF EXISTS trigger_welcome_after_verification ON customer_accounts;
CREATE TRIGGER trigger_welcome_after_verification
  AFTER UPDATE ON customer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_welcome_email_on_verification();

-- Fix historical data - Update existing customer accounts to sync with auth status
UPDATE customer_accounts 
SET email_verified = true, updated_at = NOW()
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email_confirmed_at IS NOT NULL
) AND email_verified = false;

-- Link orphaned customer accounts to auth users
UPDATE customer_accounts 
SET user_id = au.id, updated_at = NOW()
FROM auth.users au
WHERE customer_accounts.email = au.email 
  AND customer_accounts.user_id IS NULL 
  AND au.email_confirmed_at IS NOT NULL;

-- Queue welcome emails for verified users who didn't receive them
INSERT INTO communication_events (
  event_type,
  recipient_email,
  template_key,
  status,
  variables,
  created_at
)
SELECT 
  'customer_welcome',
  ca.email,
  'customer_welcome',
  'queued',
  jsonb_build_object(
    'customer_name', ca.name,
    'customer_email', ca.email
  ),
  NOW()
FROM customer_accounts ca
WHERE ca.email_verified = true
  AND NOT EXISTS (
    SELECT 1 FROM communication_events ce 
    WHERE ce.recipient_email = ca.email 
    AND ce.event_type = 'customer_welcome'
  );