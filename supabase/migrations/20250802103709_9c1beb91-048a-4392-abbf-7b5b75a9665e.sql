-- Create trigger to automatically create customer records when auth users are created
CREATE OR REPLACE FUNCTION public.handle_customer_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert into customers table if email doesn't already exist
  INSERT INTO public.customers (name, email, phone)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (email) DO NOTHING;
  
  -- Create customer_accounts record linking auth user to customer
  INSERT INTO public.customer_accounts (user_id, name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Queue welcome email for new customer registration
  INSERT INTO public.communication_events (
    event_type,
    recipient_email,
    template_key,
    template_variables,
    status,
    email_type,
    variables
  ) VALUES (
    'customer_welcome',
    NEW.email,
    'customer_welcome',
    jsonb_build_object(
      'customer_name', COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      'customer_email', NEW.email
    ),
    'queued'::communication_event_status,
    'transactional',
    jsonb_build_object(
      'customer_name', COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      'customer_email', NEW.email,
      'registration_type', 'frontend_auth'
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for customer registration
DROP TRIGGER IF EXISTS on_customer_auth_created ON auth.users;
CREATE TRIGGER on_customer_auth_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  WHEN (NEW.email IS NOT NULL AND NEW.email NOT LIKE '%admin%')
  EXECUTE FUNCTION public.handle_customer_registration();

-- Update existing customers table to ensure uniqueness
ALTER TABLE public.customers 
ADD CONSTRAINT customers_email_unique UNIQUE (email);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_communication_events_recipient_type 
ON public.communication_events (recipient_email, event_type, status);