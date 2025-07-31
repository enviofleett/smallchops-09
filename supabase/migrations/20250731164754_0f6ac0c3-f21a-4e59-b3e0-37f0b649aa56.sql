-- Fix search path security warnings for functions
CREATE OR REPLACE FUNCTION public.trigger_customer_welcome_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Send welcome email for new customer accounts
  INSERT INTO public.communication_events (
    event_type,
    recipient_email,
    template_key,
    template_variables,
    event_metadata,
    scheduled_for,
    created_at
  ) VALUES (
    'welcome_email',
    NEW.email,
    'welcome_customer',
    jsonb_build_object(
      'customerName', COALESCE(NEW.name, 'Valued Customer'),
      'companyName', 'Starters',
      'siteUrl', 'https://your-site.lovable.app'
    ),
    jsonb_build_object(
      'customer_id', NEW.id,
      'trigger', 'new_customer_registration'
    ),
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE OR REPLACE FUNCTION public.handle_new_customer_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Create customer_accounts record when user signs up via auth
  -- Phone number must be provided from user metadata, otherwise fail
  IF NEW.raw_user_meta_data->>'phone' IS NULL OR trim(NEW.raw_user_meta_data->>'phone') = '' THEN
    RAISE EXCEPTION 'Phone number is required for customer registration';
  END IF;
  
  INSERT INTO public.customer_accounts (user_id, name, phone)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';