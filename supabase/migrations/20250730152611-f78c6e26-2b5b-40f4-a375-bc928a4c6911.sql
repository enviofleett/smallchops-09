-- Create email templates with default e-commerce templates
INSERT INTO enhanced_email_templates (template_key, template_name, subject_template, html_template, text_template, template_type, variables, is_active) VALUES
-- Order confirmation email
('order_confirmation', 'Order Confirmation', 
 'Order Confirmation - {{orderNumber}}', 
 '<h1>Thank you for your order!</h1>
  <p>Hi {{customerName}},</p>
  <p>We have received your order and are preparing it for you.</p>
  <h2>Order Details:</h2>
  <p><strong>Order Number:</strong> {{orderNumber}}</p>
  <p><strong>Order Total:</strong> ₦{{orderTotal}}</p>
  <p><strong>Order Type:</strong> {{orderType}}</p>
  {{#if deliveryAddress}}
  <p><strong>Delivery Address:</strong> {{deliveryAddress}}</p>
  {{/if}}
  {{#if pickupAddress}}
  <p><strong>Pickup Address:</strong> {{pickupAddress}}</p>
  {{/if}}
  <p>You can track your order status anytime.</p>
  <p>Thank you for choosing us!</p>',
 'Thank you for your order! Order Number: {{orderNumber}}, Total: ₦{{orderTotal}}. We are preparing your order.',
 'transactional',
 ARRAY['customerName', 'orderNumber', 'orderTotal', 'orderType', 'deliveryAddress', 'pickupAddress'],
 true),

-- Order status update email
('order_status_update', 'Order Status Update',
 'Order {{orderNumber}} - Status Update',
 '<h1>Your order status has been updated</h1>
  <p>Hi {{customerName}},</p>
  <p>Your order <strong>{{orderNumber}}</strong> status has been updated to: <strong>{{newStatus}}</strong></p>
  {{#if estimatedTime}}
  <p><strong>Estimated Time:</strong> {{estimatedTime}}</p>
  {{/if}}
  <p>Thank you for your patience!</p>',
 'Order {{orderNumber}} status updated to: {{newStatus}}',
 'transactional',
 ARRAY['customerName', 'orderNumber', 'newStatus', 'oldStatus', 'estimatedTime'],
 true),

-- Payment confirmation email
('payment_confirmation', 'Payment Confirmation',
 'Payment Confirmed - {{orderNumber}}',
 '<h1>Payment Confirmed!</h1>
  <p>Hi {{customerName}},</p>
  <p>We have successfully received your payment for order <strong>{{orderNumber}}</strong>.</p>
  <p><strong>Amount Paid:</strong> ₦{{amount}}</p>
  <p><strong>Payment Method:</strong> {{paymentMethod}}</p>
  <p>Your order is now being processed.</p>',
 'Payment confirmed for order {{orderNumber}}. Amount: ₦{{amount}}',
 'transactional',
 ARRAY['customerName', 'orderNumber', 'amount', 'paymentMethod'],
 true),

-- Welcome email for new customers
('customer_welcome', 'Welcome New Customer',
 'Welcome to {{businessName}}!',
 '<h1>Welcome to {{businessName}}!</h1>
  <p>Hi {{customerName}},</p>
  <p>Thank you for creating an account with us. We are excited to serve you!</p>
  <p>You can now:</p>
  <ul>
    <li>Browse our products</li>
    <li>Track your orders</li>
    <li>Manage your favorites</li>
    <li>Receive exclusive offers</li>
  </ul>
  <p>Happy shopping!</p>',
 'Welcome to {{businessName}}! Thank you for joining us, {{customerName}}.',
 'transactional',
 ARRAY['customerName', 'businessName'],
 true),

-- Password reset email
('password_reset', 'Password Reset',
 'Password Reset Request',
 '<h1>Password Reset Request</h1>
  <p>Hi {{customerName}},</p>
  <p>You have requested to reset your password. Click the link below to create a new password:</p>
  <p><a href="{{resetLink}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
  <p>This link will expire in 1 hour.</p>
  <p>If you did not request this reset, please ignore this email.</p>',
 'Password reset link: {{resetLink}}',
 'transactional',
 ARRAY['customerName', 'resetLink'],
 true)

ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  variables = EXCLUDED.variables,
  updated_at = NOW();

-- Insert default SMTP configuration
INSERT INTO communication_settings (
  enable_email,
  smtp_host,
  smtp_port,
  smtp_user,
  smtp_pass,
  sender_email,
  sender_name,
  triggers
) VALUES (
  true,
  'mail.enviofleet.com',
  587,
  'support@enviofleet.com',
  '',  -- Will be set via environment or admin panel
  'support@enviofleet.com',
  'Starters',
  '{"order_confirmation": true, "order_status_update": true, "payment_confirmation": true, "customer_welcome": true}'::jsonb
) ON CONFLICT DO NOTHING;

-- Create trigger for order email notifications
CREATE OR REPLACE FUNCTION trigger_order_emails()
RETURNS TRIGGER AS $$
BEGIN
  -- Send order confirmation email when order is first created
  IF TG_OP = 'INSERT' THEN
    INSERT INTO communication_events (
      order_id,
      event_type,
      recipient_email,
      template_id,
      email_type,
      status,
      variables
    ) VALUES (
      NEW.id,
      'order_confirmation',
      NEW.customer_email,
      'order_confirmation',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', NEW.customer_name,
        'orderNumber', NEW.order_number,
        'orderTotal', NEW.total_amount::text,
        'orderType', NEW.order_type,
        'deliveryAddress', NEW.delivery_address,
        'pickupAddress', CASE WHEN NEW.order_type = 'pickup' THEN 'Store Location' ELSE NULL END
      )
    );
    RETURN NEW;
  END IF;

  -- Send status update email when order status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO communication_events (
      order_id,
      event_type,
      recipient_email,
      template_id,
      email_type,
      status,
      variables
    ) VALUES (
      NEW.id,
      'order_status_update',
      NEW.customer_email,
      'order_status_update',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', NEW.customer_name,
        'orderNumber', NEW.order_number,
        'newStatus', NEW.status,
        'oldStatus', OLD.status,
        'estimatedTime', CASE 
          WHEN NEW.status = 'confirmed' THEN '30-45 minutes'
          WHEN NEW.status = 'preparing' THEN '20-30 minutes'
          WHEN NEW.status = 'ready' THEN 'Ready for pickup'
          WHEN NEW.status = 'out_for_delivery' THEN '10-15 minutes'
          WHEN NEW.status = 'delivered' THEN 'Completed'
          ELSE NULL
        END
      )
    );
  END IF;

  -- Send payment confirmation email when payment is confirmed
  IF TG_OP = 'UPDATE' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.payment_status = 'paid' THEN
    INSERT INTO communication_events (
      order_id,
      event_type,
      recipient_email,
      template_id,
      email_type,
      status,
      variables
    ) VALUES (
      NEW.id,
      'payment_confirmation',
      NEW.customer_email,
      'payment_confirmation',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', NEW.customer_name,
        'orderNumber', NEW.order_number,
        'amount', NEW.total_amount::text,
        'paymentMethod', COALESCE(NEW.payment_method, 'Online Payment')
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS order_email_notifications ON orders;
CREATE TRIGGER order_email_notifications
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_order_emails();

-- Create trigger for customer welcome emails
CREATE OR REPLACE FUNCTION trigger_customer_welcome_email()
RETURNS TRIGGER AS $$
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
  FROM business_settings 
  ORDER BY updated_at DESC 
  LIMIT 1;

  -- Send welcome email for new customer accounts
  IF user_email IS NOT NULL THEN
    INSERT INTO communication_events (
      event_type,
      recipient_email,
      template_id,
      email_type,
      status,
      variables
    ) VALUES (
      'customer_welcome',
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create welcome email trigger
DROP TRIGGER IF EXISTS customer_welcome_email ON customer_accounts;
CREATE TRIGGER customer_welcome_email
  AFTER INSERT ON customer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_customer_welcome_email();