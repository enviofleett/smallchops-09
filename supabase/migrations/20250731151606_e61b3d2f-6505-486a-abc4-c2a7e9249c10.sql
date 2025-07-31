-- Phase 1: Fix Dashboard Display - Include ALL customers from both tables
-- Update the customer analytics to show ALL customers, not just those with orders

-- Add function to get all customers (including those without orders)
CREATE OR REPLACE FUNCTION public.get_all_customers_for_analytics()
RETURNS TABLE(
  customer_id uuid,
  customer_name text,
  customer_email text,
  customer_phone text,
  is_registered boolean,
  registration_date timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Get all registered customers from customers table
  SELECT 
    c.id as customer_id,
    c.name as customer_name,
    c.email as customer_email,
    c.phone as customer_phone,
    true as is_registered,
    c.created_at as registration_date
  FROM public.customers c
  
  UNION ALL
  
  -- Get guest customers from orders who aren't in customers table
  SELECT 
    gen_random_uuid() as customer_id,  -- Generate ID for guest customers
    o.customer_name,
    o.customer_email,
    o.customer_phone,
    false as is_registered,
    MIN(o.order_time) as registration_date
  FROM public.orders o
  WHERE o.customer_id IS NULL  -- Only guest orders
    AND NOT EXISTS (
      SELECT 1 FROM public.customers c 
      WHERE c.email = o.customer_email
    )
  GROUP BY o.customer_name, o.customer_email, o.customer_phone;
$$;

-- Phase 2: Fix Email System - Update trigger to use correct event type
-- Update the customer welcome email trigger to match the processor
CREATE OR REPLACE FUNCTION public.trigger_customer_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email TEXT;
  business_name TEXT;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email 
  FROM auth.users 
  WHERE id = NEW.user_id;
  
  -- Get business name from settings
  SELECT name INTO business_name 
  FROM public.business_settings 
  ORDER BY updated_at DESC 
  LIMIT 1;

  -- Send welcome email with matching event type
  IF user_email IS NOT NULL THEN
    INSERT INTO public.communication_events (
      event_type,
      recipient_email,
      template_id,
      email_type,
      status,
      variables
    ) VALUES (
      'customer_welcome',  -- This matches the processor
      user_email,
      'customer_welcome',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', NEW.name,
        'businessName', COALESCE(business_name, 'Our Store')
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS on_customer_account_created ON public.customer_accounts;
CREATE TRIGGER on_customer_account_created
  AFTER INSERT ON public.customer_accounts
  FOR EACH ROW 
  EXECUTE FUNCTION public.trigger_customer_welcome_email();

-- Phase 3: Add welcome email template if it doesn't exist
INSERT INTO public.enhanced_email_templates (
  template_key,
  template_name,
  subject_template,
  html_template,
  text_template,
  template_type,
  category,
  is_active,
  variables
) VALUES (
  'customer_welcome',
  'Customer Welcome Email',
  'Welcome to {{businessName}}!',
  '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to {{businessName}}!</h1>
    </div>
    
    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Hi {{customerName}},</h2>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
            Thank you for creating an account with {{businessName}}! We''re excited to have you as part of our community.
        </p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="margin-top: 0; color: #667eea;">What''s Next?</h3>
            <ul style="padding-left: 20px;">
                <li>Browse our product catalog</li>
                <li>Add items to your favorites</li>
                <li>Enjoy personalized recommendations</li>
                <li>Track your order history</li>
            </ul>
        </div>
        
        <p style="font-size: 16px;">
            If you have any questions, feel free to reach out to our support team. We''re here to help!
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{websiteUrl}}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Start Shopping
            </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="font-size: 14px; color: #666; text-align: center;">
            Best regards,<br>
            The {{businessName}} Team
        </p>
    </div>
</body>
</html>',
  'Welcome to {{businessName}}!

Hi {{customerName}},

Thank you for creating an account with {{businessName}}! We''re excited to have you as part of our community.

What''s Next?
- Browse our product catalog
- Add items to your favorites  
- Enjoy personalized recommendations
- Track your order history

If you have any questions, feel free to reach out to our support team. We''re here to help!

Visit us at: {{websiteUrl}}

Best regards,
The {{businessName}} Team',
  'transactional',
  'customer',
  true,
  ARRAY['customerName', 'businessName', 'websiteUrl']
) ON CONFLICT (template_key) DO UPDATE SET
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  subject_template = EXCLUDED.subject_template,
  is_active = true,
  updated_at = NOW();

-- Phase 4: Ensure communication events can be processed
-- Check if there are any failed events and reset them for retry
UPDATE public.communication_events 
SET status = 'queued', retry_count = 0, error_message = NULL
WHERE status = 'failed' 
  AND event_type = 'customer_welcome'
  AND created_at > NOW() - INTERVAL '7 days';

-- Create index for better performance on communication events processing
CREATE INDEX IF NOT EXISTS idx_communication_events_processing 
ON public.communication_events (status, event_type, created_at) 
WHERE status IN ('queued', 'processing');