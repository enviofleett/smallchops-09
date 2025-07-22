
-- Add missing fields to business_settings table
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS tagline TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS twitter_url TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS youtube_url TEXT,
ADD COLUMN IF NOT EXISTS seo_title TEXT,
ADD COLUMN IF NOT EXISTS seo_description TEXT,
ADD COLUMN IF NOT EXISTS seo_keywords TEXT;

-- Create admin invitations table for tracking admin user creation
CREATE TABLE IF NOT EXISTS public.admin_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  role public.user_role NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on admin invitations
ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

-- Create policy for admin invitations
CREATE POLICY "Admins can manage admin invitations"
ON public.admin_invitations FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Create trigger for updated_at
CREATE TRIGGER handle_updated_at_admin_invitations
BEFORE UPDATE ON public.admin_invitations
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- Create audit logs trigger for admin invitations
CREATE TRIGGER admin_invitations_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.admin_invitations
FOR EACH ROW EXECUTE FUNCTION public.log_settings_changes();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_invitations_email ON public.admin_invitations(email);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_status ON public.admin_invitations(status);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_expires_at ON public.admin_invitations(expires_at);
