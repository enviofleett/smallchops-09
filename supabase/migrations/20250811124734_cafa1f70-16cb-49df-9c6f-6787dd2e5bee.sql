-- Create admin invitations table if not exists
CREATE TABLE IF NOT EXISTS admin_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin',
  invited_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  invitation_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create profiles table if not exists
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE admin_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin_invitations
CREATE POLICY "Admins can manage invitations" ON admin_invitations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage profiles" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Create helper functions
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$;

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create function to send admin invitation
CREATE OR REPLACE FUNCTION send_admin_invitation(
  p_email TEXT,
  p_role TEXT DEFAULT 'admin',
  p_invited_by UUID DEFAULT auth.uid()
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
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