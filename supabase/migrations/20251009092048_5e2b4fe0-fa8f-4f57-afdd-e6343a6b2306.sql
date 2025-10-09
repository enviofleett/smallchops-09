-- Drop the problematic trigger and function with CASCADE
DROP TRIGGER IF EXISTS trigger_permissions_after_insert ON profiles;
DROP FUNCTION IF EXISTS setup_permissions_after_insert() CASCADE;

-- Auto-create profiles for all new auth.users signups
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

-- Backfill orphaned users (create profiles for existing auth.users without profiles)
INSERT INTO public.profiles (id, email, name, created_at, updated_at)
SELECT 
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'full_name',
    split_part(u.email, '@', 1)
  ) as name,
  u.created_at,
  NOW()
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Add unique constraint on rule_name if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'alert_rules_rule_name_key'
  ) THEN
    ALTER TABLE alert_rules ADD CONSTRAINT alert_rules_rule_name_key UNIQUE (rule_name);
  END IF;
END $$;

-- Create alert rule to monitor for orphaned users
INSERT INTO alert_rules (
  rule_name,
  condition_sql,
  threshold_value,
  severity,
  check_interval_seconds,
  is_active
) VALUES (
  'Orphaned Users Without Profiles',
  'SELECT COUNT(*) FROM auth.users u LEFT JOIN profiles p ON u.id = p.id WHERE p.id IS NULL',
  0,
  'critical',
  300,
  true
)
ON CONFLICT (rule_name) DO UPDATE SET
  condition_sql = EXCLUDED.condition_sql,
  is_active = true,
  updated_at = NOW();