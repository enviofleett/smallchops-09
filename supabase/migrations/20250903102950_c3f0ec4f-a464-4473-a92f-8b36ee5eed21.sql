-- Create pickup ready email template for production use
INSERT INTO enhanced_email_templates (
  template_key,
  template_name,
  email_subject,
  email_body,
  is_active,
  created_at,
  updated_at
) VALUES (
  'pickup_ready',
  'Order Ready for Pickup',
  'Your order #{{order_number}} is ready for pickup! 📦',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Ready for Pickup</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">🎉 Your order is ready!</h1>
    <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Time to pick up your delicious treats</p>
  </div>
  
  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #059669;">
      <h2 style="color: #065f46; margin: 0 0 10px 0; font-size: 18px;">Order #{{order_number}}</h2>
      <p style="color: #047857; margin: 0; font-size: 16px; font-weight: 600;">✅ Ready for pickup now!</p>
    </div>

    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #f59e0b;">
      <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">📍 Pickup Instructions</h3>
      <ul style="color: #92400e; margin: 0; padding-left: 20px;">
        <li>Visit our store location</li>
        <li>Present this email or your order number</li>
        <li>Our team will have your order ready</li>
        <li>Please bring a valid ID for verification</li>
      </ul>
    </div>

    <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #3b82f6;">
      <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">📞 Need Help?</h3>
      <p style="color: #1e40af; margin: 0;">
        Call us: <strong>{{support_phone}}</strong><br>
        Email: <strong>{{support_email}}</strong><br>
        We are here to help make your pickup smooth!
      </p>
    </div>

    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
      <p style="color: #6b7280; margin: 0; font-size: 14px;">Thank you for choosing {{business_name}}!</p>
      <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 14px;">We cannot wait to see you at pickup.</p>
    </div>
  </div>
</body>
</html>',
  true,
  NOW(),
  NOW()
);

-- Log the template creation
INSERT INTO audit_logs (
  action,
  category, 
  message,
  new_values
) VALUES (
  'pickup_ready_template_created',
  'Email Templates',
  'Created pickup ready email template for production',
  jsonb_build_object(
    'template_key', 'pickup_ready',
    'purpose', 'pickup_order_ready_notification',
    'production_ready', true
  )
);