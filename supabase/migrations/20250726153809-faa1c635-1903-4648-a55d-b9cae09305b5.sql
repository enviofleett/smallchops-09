-- Phase 1: Fix Database Schema - Remove problematic constraint and add proper one

-- First, drop the problematic unique constraint that's causing the edge function errors
ALTER TABLE public.user_permissions 
DROP CONSTRAINT IF EXISTS user_permissions_user_id_menu_section_key;

-- Add the correct unique constraint on (user_id, menu_key) to prevent duplicate menu keys
ALTER TABLE public.user_permissions 
ADD CONSTRAINT user_permissions_user_id_menu_key_key UNIQUE (user_id, menu_key);

-- Clean up any existing duplicate entries before applying the new constraint
-- Keep only the latest entry for each user_id + menu_key combination
DELETE FROM public.user_permissions a USING public.user_permissions b 
WHERE a.user_id = b.user_id 
  AND a.menu_key = b.menu_key 
  AND a.created_at < b.created_at;

-- Create audit table for permission changes tracking
CREATE TABLE IF NOT EXISTS public.user_permission_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  menu_key text NOT NULL,
  menu_section text,
  permission_level permission_level NOT NULL,
  action text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  changed_by uuid,
  changed_at timestamp with time zone DEFAULT now(),
  old_values jsonb,
  new_values jsonb
);

-- Enable RLS on audit table
ALTER TABLE public.user_permission_audit ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for audit table
CREATE POLICY "Admins can view permission audit logs" 
ON public.user_permission_audit 
FOR SELECT 
USING (is_admin());

CREATE POLICY "System can insert permission audit logs" 
ON public.user_permission_audit 
FOR INSERT 
WITH CHECK (true);

-- Create function to log permission changes
CREATE OR REPLACE FUNCTION public.log_permission_change()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_permission_audit (
      user_id, menu_key, menu_section, permission_level, action, changed_by, new_values
    ) VALUES (
      NEW.user_id, NEW.menu_key, NEW.menu_section, NEW.permission_level, 'INSERT', auth.uid(), to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.user_permission_audit (
      user_id, menu_key, menu_section, permission_level, action, changed_by, old_values, new_values
    ) VALUES (
      NEW.user_id, NEW.menu_key, NEW.menu_section, NEW.permission_level, 'UPDATE', auth.uid(), to_jsonb(OLD), to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.user_permission_audit (
      user_id, menu_key, menu_section, permission_level, action, changed_by, old_values
    ) VALUES (
      OLD.user_id, OLD.menu_key, OLD.menu_section, OLD.permission_level, 'DELETE', auth.uid(), to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for permission audit logging
DROP TRIGGER IF EXISTS user_permissions_audit_trigger ON public.user_permissions;
CREATE TRIGGER user_permissions_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_permission_change();