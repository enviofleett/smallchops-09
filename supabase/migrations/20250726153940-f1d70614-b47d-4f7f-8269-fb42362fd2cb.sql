-- Phase 1: Fix Database Schema - Remove problematic constraint and add proper one

-- First, check if we have duplicates by menu_key before adding constraint
-- Clean up any existing duplicate entries first
DELETE FROM public.user_permissions a USING public.user_permissions b 
WHERE a.id > b.id 
  AND a.user_id = b.user_id 
  AND a.menu_key = b.menu_key;

-- Drop the problematic unique constraint that's causing the edge function errors
ALTER TABLE public.user_permissions 
DROP CONSTRAINT IF EXISTS user_permissions_user_id_menu_section_key;

-- Add the correct unique constraint on (user_id, menu_key) to prevent duplicate menu keys
ALTER TABLE public.user_permissions 
ADD CONSTRAINT user_permissions_user_id_menu_key_key UNIQUE (user_id, menu_key);

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