-- Fix production issue: make menu_section nullable to support menu_key based permissions
-- The system has evolved to use menu_key instead of menu_section

-- First drop the NOT NULL constraint on menu_section
ALTER TABLE public.user_permissions 
ALTER COLUMN menu_section DROP NOT NULL;

-- Update any existing records that might have null menu_section with a valid enum value
UPDATE public.user_permissions 
SET menu_section = 'settings'
WHERE menu_section IS NULL;

-- Add an index on menu_key for better performance since it's now the primary identifier
CREATE INDEX IF NOT EXISTS idx_user_permissions_menu_key_fast 
ON public.user_permissions(menu_key, permission_level);

-- Ensure the unique constraint is on (user_id, menu_key) not (user_id, menu_section)
ALTER TABLE public.user_permissions 
DROP CONSTRAINT IF EXISTS user_permissions_user_id_menu_section_key;

-- Add or recreate the correct unique constraint
ALTER TABLE public.user_permissions 
DROP CONSTRAINT IF EXISTS user_permissions_user_id_menu_key_key;

ALTER TABLE public.user_permissions 
ADD CONSTRAINT user_permissions_user_id_menu_key_key 
UNIQUE (user_id, menu_key);

-- Log this critical production fix
INSERT INTO audit_logs (
  action, category, message, user_id, new_values
) VALUES (
  'critical_production_fix',
  'Database Maintenance', 
  'PRODUCTION FIX: Fixed user_permissions table schema - made menu_section nullable for production compatibility',
  auth.uid(),
  jsonb_build_object(
    'table', 'user_permissions',
    'change', 'menu_section_made_nullable',
    'reason', 'fix_production_constraint_violation',
    'error_resolved', 'null_value_in_menu_section_constraint'
  )
);