
-- Fix function search path warnings and enhance security
-- Update existing functions to use explicit search_path settings

-- Update the user role function to be more secure
CREATE OR REPLACE FUNCTION public.get_user_role(user_id_to_check uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT role::TEXT FROM public.profiles WHERE id = user_id_to_check;
$$;

-- Update the admin check function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid();
$$;

-- Update the settings changes logging function
CREATE OR REPLACE FUNCTION public.log_settings_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  actor_id UUID;
  new_jsonb JSONB;
  old_jsonb JSONB;
BEGIN
  -- Convert row records to jsonb
  IF TG_OP != 'DELETE' THEN
    new_jsonb := to_jsonb(NEW);
  END IF;
  IF TG_OP != 'INSERT' THEN
    old_jsonb := to_jsonb(OLD);
  END IF;

  -- Try to get the user ID from connected_by column if it exists
  IF TG_OP = 'DELETE' THEN
    IF old_jsonb ? 'connected_by' THEN
      actor_id := (old_jsonb ->> 'connected_by')::uuid;
    END IF;
  ELSE
    IF new_jsonb ? 'connected_by' THEN
      actor_id := (new_jsonb ->> 'connected_by')::uuid;
    END IF;
  END IF;

  -- Fallback to auth.uid()
  IF actor_id IS NULL THEN
    actor_id := auth.uid();
  END IF;
  
  INSERT INTO public.audit_logs (
    user_id,
    action,
    category,
    entity_type,
    entity_id,
    message,
    old_values,
    new_values
  ) VALUES (
    actor_id,
    TG_OP,
    'Settings',
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CONCAT(TG_TABLE_NAME, ' ', TG_OP, ' by user ', COALESCE(actor_id::text, 'system')),
    CASE WHEN TG_OP = 'DELETE' THEN old_jsonb ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN new_jsonb ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Update the order status change communication trigger function
CREATE OR REPLACE FUNCTION public.queue_order_status_change_communication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert an event into the queue only when the order status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.communication_events (order_id, event_type, payload)
    VALUES (
      NEW.id,
      'order_status_update',
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'customer_name', NEW.customer_name,
        'customer_phone', NEW.customer_phone,
        'customer_email', NEW.customer_email
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Update the new user handler function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  admin_count INTEGER;
  new_user_role public.user_role;
BEGIN
  -- Lock table to prevent race condition
  LOCK TABLE public.profiles IN EXCLUSIVE MODE;

  -- Check if any admin users exist
  SELECT count(*) INTO admin_count FROM public.profiles WHERE role = 'admin';

  -- If no admins exist, make this user an admin
  IF admin_count = 0 THEN
    new_user_role := 'admin';
  ELSE
    new_user_role := 'staff';
  END IF;

  -- Insert new profile
  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', new_user_role);
  
  RETURN NEW;
END;
$$;

-- Create a function to validate business settings data
CREATE OR REPLACE FUNCTION public.validate_business_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Validate required fields
  IF NEW.name IS NULL OR trim(NEW.name) = '' THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;
  
  -- Validate email format if provided
  IF NEW.email IS NOT NULL AND NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;
  
  -- Validate social_links JSON if provided
  IF NEW.social_links IS NOT NULL THEN
    BEGIN
      PERFORM NEW.social_links::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid JSON format for social_links';
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add validation trigger for business settings
DROP TRIGGER IF EXISTS validate_business_settings_trigger ON public.business_settings;
CREATE TRIGGER validate_business_settings_trigger
  BEFORE INSERT OR UPDATE ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.validate_business_settings();

-- Create an index for better performance on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_communication_events_status ON public.communication_events(status);
CREATE INDEX IF NOT EXISTS idx_communication_logs_order_id ON public.communication_logs(order_id);
