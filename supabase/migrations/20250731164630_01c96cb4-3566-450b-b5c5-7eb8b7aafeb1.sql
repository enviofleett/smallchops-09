-- Update customer registration trigger to send welcome email
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
$$ LANGUAGE plpgsql SECURITY DEFINER;