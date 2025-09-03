-- Seed missing email templates for order status notifications

-- First, ensure the enhanced_email_templates table has all required templates
INSERT INTO enhanced_email_templates (
  template_key,
  template_name,
  subject_template,
  html_template,
  text_template,
  template_variables,
  is_active,
  created_at,
  updated_at
) VALUES
-- Order Preparing Template
(
  'order_preparing',
  'Order Being Prepared',
  'Your Order #{order_number} is Being Prepared! 👨‍🍳',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Being Prepared</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #e67e22; margin-bottom: 10px;">👨‍🍳 Great News!</h1>
    <h2 style="color: #2c3e50; margin-top: 0;">Your Order is Being Prepared</h2>
  </div>
  
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <p><strong>Hi {{customer_name}},</strong></p>
    <p>Exciting news! Our kitchen team has started preparing your delicious order.</p>
    <p><strong>Order Number:</strong> {{order_number}}<br>
    <strong>Estimated Ready Time:</strong> {{estimated_ready_time}}</p>
  </div>
  
  <div style="margin: 20px 0;">
    <h3 style="color: #2c3e50;">What happens next?</h3>
    <ul style="padding-left: 20px;">
      <li>Our chefs are carefully preparing your items</li>
      <li>You''ll get notified when your order is ready</li>
      <li>{{order_type}} will be available shortly</li>
    </ul>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <p style="color: #7f8c8d;">Questions? Contact us at {{support_email}}</p>
    <p style="color: #95a5a6; font-size: 14px;">© {{current_year}} {{business_name}}. All rights reserved.</p>
  </div>
</body>
</html>',
  '👨‍🍳 Order Being Prepared - #{order_number}

Hi {{customer_name}},

Great news! Our kitchen team has started preparing your delicious order.

📋 Order Details:
Order Number: {{order_number}}
Estimated Ready Time: {{estimated_ready_time}}
Order Type: {{order_type}}

What happens next?
• Our chefs are carefully preparing your items
• You''ll get notified when your order is ready
• {{order_type}} will be available shortly

Questions? Contact us at {{support_email}}
© {{current_year}} {{business_name}}. All rights reserved.',
  '["customer_name", "order_number", "estimated_ready_time", "order_type", "support_email", "business_name", "current_year"]',
  true,
  NOW(),
  NOW()
),

-- Order Ready Template  
(
  'order_ready',
  'Order Ready for Pickup',
  'Your Order #{order_number} is Ready! 🎉',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Ready</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #27ae60; margin-bottom: 10px;">🎉 Your Order is Ready!</h1>
    <h2 style="color: #2c3e50; margin-top: 0;">Time to Pick Up</h2>
  </div>
  
  <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #27ae60;">
    <p><strong>Hi {{customer_name}},</strong></p>
    <p>Your order is freshly prepared and ready for pickup!</p>
    <p><strong>Order Number:</strong> {{order_number}}<br>
    <strong>Pickup Location:</strong> {{pickup_location}}<br>
    <strong>Please collect by:</strong> {{collection_deadline}}</p>
  </div>
  
  <div style="margin: 20px 0;">
    <h3 style="color: #2c3e50;">Pickup Instructions:</h3>
    <ul style="padding-left: 20px;">
      <li>Show your order number: <strong>{{order_number}}</strong></li>
      <li>Location: {{pickup_location}}</li>
      <li>Our staff will have your order ready</li>
    </ul>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <p style="color: #7f8c8d;">Questions? Contact us at {{support_email}}</p>
    <p style="color: #95a5a6; font-size: 14px;">© {{current_year}} {{business_name}}. All rights reserved.</p>
  </div>
</body>
</html>',
  '🎉 Order Ready for Pickup - #{order_number}

Hi {{customer_name}},

Your order is freshly prepared and ready for pickup!

📋 Pickup Details:
Order Number: {{order_number}}
Pickup Location: {{pickup_location}}
Please collect by: {{collection_deadline}}

Pickup Instructions:
• Show your order number: {{order_number}}
• Location: {{pickup_location}}
• Our staff will have your order ready

Questions? Contact us at {{support_email}}
© {{current_year}} {{business_name}}. All rights reserved.',
  '["customer_name", "order_number", "pickup_location", "collection_deadline", "support_email", "business_name", "current_year"]',
  true,
  NOW(),
  NOW()
)

-- Handle conflicts by updating existing records
ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  template_variables = EXCLUDED.template_variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Update the email template validator to use correct template keys
UPDATE src.utils.emailTemplateValidator 
SET REQUIRED_TEMPLATE_KEYS = ARRAY[
  'order_confirmed',
  'order_preparing', 
  'order_ready',
  'out_for_delivery',
  'order_completed',
  'order_canceled',
  'payment_confirmed',
  'admin_new_order',
  'customer_welcome'
] WHERE 1=0; -- This is a comment/documentation line, not actual SQL

-- Log the seeding operation
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values,
  created_at
) VALUES (
  'email_templates_seeded',
  'Email System',
  'Seeded missing email templates for order status notifications',
  jsonb_build_object(
    'templates_added', ARRAY['order_preparing', 'order_ready'],
    'total_required', 9,
    'seeded_at', NOW()
  ),
  NOW()
);