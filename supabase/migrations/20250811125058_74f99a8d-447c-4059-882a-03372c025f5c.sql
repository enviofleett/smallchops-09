-- Fix security warnings by adding proper search_path to functions
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Check if there's a pending invitation for this email
  SELECT * INTO invitation_record
  FROM admin_invitations
  WHERE email = NEW.email 
    AND status = 'pending'
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  -- Create profile with appropriate role
  INSERT INTO profiles (id, email, name, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(invitation_record.role, 'user'),
    NOW()
  );

  -- If there was an invitation, mark it as accepted
  IF invitation_record.id IS NOT NULL THEN
    UPDATE admin_invitations
    SET status = 'accepted', accepted_at = NOW()
    WHERE id = invitation_record.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION send_admin_invitation(
  p_email TEXT,
  p_role TEXT DEFAULT 'admin',
  p_invited_by UUID DEFAULT auth.uid()
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_id UUID;
  invitation_token TEXT;
  result JSON;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM profiles WHERE email = p_email) THEN
    RETURN json_build_object('success', false, 'error', 'User already exists');
  END IF;

  -- Check if invitation already exists
  IF EXISTS (
    SELECT 1 FROM admin_invitations 
    WHERE email = p_email AND status = 'pending' AND expires_at > NOW()
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Invitation already pending');
  END IF;

  -- Create invitation
  INSERT INTO admin_invitations (email, role, invited_by)
  VALUES (p_email, p_role, p_invited_by)
  RETURNING id, invitation_token INTO invitation_id, invitation_token;

  -- Log the invitation
  INSERT INTO audit_logs (
    action, category, message, user_id, new_values
  ) VALUES (
    'admin_invitation_sent',
    'User Management',
    'Admin invitation sent to ' || p_email,
    p_invited_by,
    json_build_object(
      'invitation_id', invitation_id,
      'email', p_email,
      'role', p_role
    )
  );

  RETURN json_build_object(
    'success', true,
    'invitation_id', invitation_id,
    'invitation_token', invitation_token
  );
END;
$$;