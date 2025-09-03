-- Create a production-ready trigger to automatically send welcome emails to new customers
-- This ensures ALL new customer registrations trigger welcome emails regardless of registration path

-- First, create or replace the function to handle new customer welcome emails
CREATE OR REPLACE FUNCTION public.trigger_customer_welcome_email()
RETURNS TRIGGER AS $$
BEGIN
    -- Only send welcome email if email is verified and customer is new
    IF NEW.email_verified = true AND (OLD IS NULL OR OLD.email_verified = false) THEN
        -- Insert welcome email event into communication queue
        INSERT INTO public.communication_events (
            event_type,
            recipient_email,
            template_key,
            email_type,
            status,
            priority,
            variables,
            metadata,
            created_at,
            scheduled_at
        ) VALUES (
            'customer_welcome',
            LOWER(NEW.email),
            'customer_welcome',
            'transactional',
            'queued',
            'high',
            jsonb_build_object(
                'customerName', COALESCE(NEW.name, split_part(NEW.email, '@', 1)),
                'customerEmail', LOWER(NEW.email),
                'companyName', (SELECT name FROM business_settings LIMIT 1),
                'loginUrl', (SELECT site_url FROM business_settings LIMIT 1),
                'welcomeDate', to_char(NOW(), 'YYYY-MM-DD')
            ),
            jsonb_build_object(
                'customer_id', NEW.id,
                'registration_source', 'auto_trigger',
                'trigger_type', 'email_verification',
                'user_id', NEW.user_id
            ),
            NOW(),
            NOW()
        );
        
        -- Log the welcome email trigger
        INSERT INTO public.audit_logs (
            action,
            category,
            message,
            entity_id,
            new_values
        ) VALUES (
            'customer_welcome_email_queued',
            'Customer Registration',
            'Welcome email automatically queued for new verified customer: ' || LOWER(NEW.email),
            NEW.id,
            jsonb_build_object(
                'customer_email', LOWER(NEW.email),
                'customer_name', NEW.name,
                'trigger_source', 'database_trigger'
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on customer_accounts table for email verification
DROP TRIGGER IF EXISTS trigger_new_customer_welcome_email ON public.customer_accounts;

CREATE TRIGGER trigger_new_customer_welcome_email
    AFTER INSERT OR UPDATE OF email_verified ON public.customer_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_customer_welcome_email();

-- Ensure the customer_welcome template exists with proper fallback content
INSERT INTO public.enhanced_email_templates (
    template_key,
    template_name,
    subject_template,
    html_template,
    text_template,
    is_active,
    template_type,
    category,
    variables,
    created_at,
    updated_at
) VALUES (
    'customer_welcome',
    'Customer Welcome Email',
    'Welcome to {{business_name}}! 🎉',
    '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to {{business_name}}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to {{business_name}}!</h1>
    </div>
    
    <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h2 style="color: #667eea; margin-top: 0;">Hi {{customerName}}! 👋</h2>
        
        <p>We are thrilled to have you join our community! Your account has been successfully created and verified.</p>
        
        <div style="background: #f8f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="margin-top: 0; color: #667eea;">What is next?</h3>
            <ul style="margin: 0; padding-left: 20px;">
                <li>Explore our products and services</li>
                <li>Complete your profile for a personalized experience</li>
                <li>Stay tuned for exclusive offers and updates</li>
            </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{loginUrl}}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">Get Started</a>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Welcome aboard! If you have any questions, feel free to reach out to our support team.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        
        <p style="color: #888; font-size: 12px; text-align: center;">
            This email was sent to {{customerEmail}} on {{welcomeDate}}<br>
            © {{business_name}}. All rights reserved.
        </p>
    </div>
</body>
</html>',
    'Welcome to {{business_name}}!

Hi {{customerName}},

We are thrilled to have you join our community! Your account has been successfully created and verified.

What is next?
- Explore our products and services  
- Complete your profile for a personalized experience
- Stay tuned for exclusive offers and updates

Get started by visiting: {{loginUrl}}

Welcome aboard! If you have any questions, feel free to reach out to our support team.

This email was sent to {{customerEmail}} on {{welcomeDate}}
© {{business_name}}. All rights reserved.',
    true,
    'transactional',
    'authentication',
    ARRAY[
        'customerName',
        'customerEmail', 
        'business_name',
        'loginUrl',
        'welcomeDate'
    ],
    NOW(),
    NOW()
) ON CONFLICT (template_key) DO UPDATE SET
    template_name = EXCLUDED.template_name,
    subject_template = EXCLUDED.subject_template,
    html_template = EXCLUDED.html_template,
    text_template = EXCLUDED.text_template,
    is_active = EXCLUDED.is_active,
    variables = EXCLUDED.variables,
    updated_at = NOW();