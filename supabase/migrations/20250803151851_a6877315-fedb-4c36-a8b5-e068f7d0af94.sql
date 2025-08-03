-- Apply the enhanced trigger function for customer registration
CREATE OR REPLACE FUNCTION public.handle_new_customer_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  customer_name TEXT;
  provider_type TEXT;
BEGIN
  BEGIN
    -- Only run this logic if the new user is being inserted and has a valid ID and email.
    IF TG_OP = 'INSERT' AND NEW.email IS NOT NULL AND NEW.id IS NOT NULL THEN
      -- Check if a customer account already exists to prevent duplicates.
      PERFORM 1 FROM public.customer_accounts WHERE user_id = NEW.id;
      IF FOUND THEN
        RETURN NEW; -- Account already exists, do nothing.
      END IF;

      -- Extract provider from raw_app_meta_data
      provider_type := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

      -- Extract customer name from user metadata or email
      customer_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1)
      );

      -- Create the customer account record.
      INSERT INTO public.customer_accounts (user_id, name, phone, email)
      VALUES (
        NEW.id,
        customer_name,
        NEW.raw_user_meta_data->>'phone',
        NEW.email
      );

      -- Queue welcome email with CORRECT format and key
      INSERT INTO public.communication_events (
        event_type,
        recipient_email,
        status,
        template_key,
        template_variables,
        priority
      ) VALUES (
        'customer_welcome',
        NEW.email,
        'queued'::communication_event_status,
        'welcome_customer',
        jsonb_build_object(
          'customerName', customer_name,
          'email', NEW.email
        ),
        'high'
      );

      -- Log successful registration
      INSERT INTO public.audit_logs (
        action,
        category,
        message,
        new_values,
        user_id
      ) VALUES (
        'customer_registered',
        'Authentication',
        'Customer registered successfully via ' || provider_type,
        jsonb_build_object(
          'customer_name', customer_name,
          'email', NEW.email,
          'provider', provider_type
        ),
        NEW.id
      );
    END IF;
    RETURN NEW;

  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't fail the registration
      INSERT INTO public.audit_logs (
        action,
        category,
        message,
        new_values
      ) VALUES (
        'customer_registration_error',
        'Authentication',
        'Error during customer registration: ' || SQLERRM,
        jsonb_build_object(
          'error', SQLERRM,
          'email', NEW.email,
          'user_id', NEW.id
        )
      );
      RETURN NEW;
  END;
END;
$$;

-- Attach the trigger to auth.users table
DROP TRIGGER IF EXISTS on_new_customer_auth ON auth.users;
CREATE TRIGGER on_new_customer_auth
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_customer_auth();

-- Add missing email templates
INSERT INTO public.enhanced_email_templates (template_key, subject, html_content, text_content, template_variables, is_active)
VALUES 
  ('welcome_customer', 'Welcome to {{businessName}}!', 
   '<h1>Welcome {{customerName}}!</h1><p>Thank you for joining {{businessName}}. We''re excited to have you on board.</p>', 
   'Welcome {{customerName}}! Thank you for joining {{businessName}}. We''re excited to have you on board.',
   '{"customerName": "string", "businessName": "string", "email": "string"}', true),
  ('login_otp', 'Your Login Code', 
   '<h1>Your Login Code</h1><p>Use this code to log in: <strong>{{otpCode}}</strong></p><p>This code expires in 10 minutes.</p>', 
   'Your login code: {{otpCode}}. This code expires in 10 minutes.',
   '{"otpCode": "string", "email": "string"}', true),
  ('password_reset_otp', 'Password Reset Code', 
   '<h1>Password Reset</h1><p>Use this code to reset your password: <strong>{{otpCode}}</strong></p><p>This code expires in 10 minutes.</p>', 
   'Your password reset code: {{otpCode}}. This code expires in 10 minutes.',
   '{"otpCode": "string", "email": "string"}', true)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  text_content = EXCLUDED.text_content,
  template_variables = EXCLUDED.template_variables,
  is_active = EXCLUDED.is_active;