-- Create user invitations table for role-based user creation
-- Date: 2024-12-30

-- Create invitation status enum
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- Create user invitations table
CREATE TABLE public.user_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  role public.user_role NOT NULL,
  name TEXT,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  -- Prevent duplicate pending invitations for same email
  CONSTRAINT unique_pending_email UNIQUE (email, status) DEFERRABLE INITIALLY DEFERRED
);

-- Add updated_at trigger
CREATE TRIGGER handle_updated_at_user_invitations
BEFORE UPDATE ON public.user_invitations
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- Enable RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Super admins can view all invitations
CREATE POLICY "Super admins can view all invitations"
ON public.user_invitations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Super admins can create invitations
CREATE POLICY "Super admins can create invitations"
ON public.user_invitations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Super admins can update invitations (e.g., revoke)
CREATE POLICY "Super admins can update invitations"
ON public.user_invitations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Create index for performance
CREATE INDEX idx_user_invitations_email ON public.user_invitations (email);
CREATE INDEX idx_user_invitations_status ON public.user_invitations (status);
CREATE INDEX idx_user_invitations_expires_at ON public.user_invitations (expires_at);

-- Function to automatically expire old invitations
CREATE OR REPLACE FUNCTION public.expire_old_invitations()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.user_invitations
  SET status = 'expired'
  WHERE status = 'pending' 
    AND expires_at < now();
END;
$$;

-- Create a function to be called when accepting invitation during user registration
CREATE OR REPLACE FUNCTION public.accept_user_invitation(invitation_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Get and lock the invitation
  SELECT * INTO invitation_record
  FROM public.user_invitations
  WHERE id = invitation_id
    AND status = 'pending'
    AND expires_at > now()
  FOR UPDATE;

  -- Check if invitation exists and is valid
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Update user profile with invited role
  UPDATE public.profiles
  SET role = invitation_record.role,
      name = COALESCE(invitation_record.name, name)
  WHERE id = user_id;

  -- Mark invitation as accepted
  UPDATE public.user_invitations
  SET status = 'accepted',
      accepted_at = now()
  WHERE id = invitation_id;

  RETURN TRUE;
END;
$$;