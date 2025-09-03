-- Fix production issue: make menu_section nullable to support menu_key based permissions
-- Check current enum values and make menu_section nullable

-- First, let's see what enum values exist for menu_section
-- We'll just make the column nullable without trying to update existing records

-- Drop the NOT NULL constraint on menu_section
ALTER TABLE public.user_permissions 
ALTER COLUMN menu_section DROP NOT NULL;

-- Ensure the unique constraint is on (user_id, menu_key) not (user_id, menu_section)
ALTER TABLE public.user_permissions 
DROP CONSTRAINT IF EXISTS user_permissions_user_id_menu_section_key;

-- Add the correct unique constraint on menu_key
ALTER TABLE public.user_permissions 
DROP CONSTRAINT IF EXISTS user_permissions_user_id_menu_key_key;

ALTER TABLE public.user_permissions 
ADD CONSTRAINT user_permissions_user_id_menu_key_key 
UNIQUE (user_id, menu_key);

-- Add performance index
CREATE INDEX IF NOT EXISTS idx_user_permissions_menu_key_lookup 
ON public.user_permissions(user_id, menu_key, permission_level);

-- Log this critical fix
INSERT INTO audit_logs (
  action, category, message, user_id, new_values
) VALUES (
  'production_hotfix_applied',
  'Database Emergency Fix', 
  'PRODUCTION HOTFIX: Fixed user_permissions schema - made menu_section nullable to resolve constraint violations',
  auth.uid(),
  jsonb_build_object(
    'table', 'user_permissions',
    'issue', 'menu_section_not_null_constraint_violation', 
    'fix', 'made_menu_section_nullable',
    'urgency', 'critical'
  )
);