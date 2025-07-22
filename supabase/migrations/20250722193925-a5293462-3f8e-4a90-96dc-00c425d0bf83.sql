
-- Remove the problematic unique constraint that's causing duplicate key errors
ALTER TABLE public.user_permissions DROP CONSTRAINT IF EXISTS user_permissions_user_id_menu_section_key;

-- Create a new unique constraint using menu_key instead of menu_section
ALTER TABLE public.user_permissions ADD CONSTRAINT user_permissions_user_id_menu_key_unique 
UNIQUE(user_id, menu_key);

-- Update the admin_management edge function to handle menu_key properly
-- First, let's add audit logging trigger to admin_invitations
CREATE TRIGGER admin_invitations_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.admin_invitations
FOR EACH ROW EXECUTE FUNCTION public.log_settings_changes();

-- Create indexes for better performance on the new constraint
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_menu_key ON public.user_permissions(user_id, menu_key);

-- Add constraint to ensure menu_key is provided when using the new system
ALTER TABLE public.user_permissions ADD CONSTRAINT check_menu_key_or_section 
CHECK (menu_key IS NOT NULL OR menu_section IS NOT NULL);
