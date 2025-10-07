-- Step 1: Update app_role enum to include new roles
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'support_staff';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'admin_manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'account_manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'store_owner';

-- Step 2: Add password management columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS password_changed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS first_login_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS created_with_temp_password boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS username text;

-- Create unique index on username
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON profiles(username) WHERE username IS NOT NULL;