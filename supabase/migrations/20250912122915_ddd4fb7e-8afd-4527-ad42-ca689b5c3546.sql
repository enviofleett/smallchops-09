-- Create missing email templates with correct template_type
INSERT INTO enhanced_email_templates (
  template_key,
  template_name,
  subject_template,
  html_template,
  text_template,
  template_type,
  category,
  is_active
) VALUES 
(
  'review_request',
  'Customer Review Request', 
  'How was your experience with {{business_name}}? Leave a review!',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Review Request</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 40px 30px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; border-top: 1px solid #e9ecef; }
    .brand { font-size: 28px; font-weight: bold; margin: 0; }
    .review-button { display: inline-block; background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
    .order-details { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
    .stars { font-size: 24px; color: #fbbf24; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="brand">{{business_name}}</h1>
      <p>Thank you for your business!</p>
    </div>
    <div class="content">
      <h2>Hi {{customer_name}}! 👋</h2>
      <p>We hope you loved your recent order! Your feedback helps us serve you better.</p>
      <div class="order-details">
        <h3>Your Order: {{order_id}}</h3>
        <p><strong>Order Date:</strong> {{order_date}}</p>
      </div>
      <div class="stars">⭐⭐⭐⭐⭐</div>
      <p>Could you take 30 seconds to share your experience?</p>
      <a href="{{review_url}}" class="review-button">Leave a Review</a>
      <p>Your honest feedback means the world to us!</p>
      <p>Best regards,<br>The {{business_name}} Team</p>
    </div>
    <div class="footer">
      <p>This email was sent by {{business_name}}.</p>
      <p><a href="{{unsubscribe_url}}" style="color: #6c757d;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>',
  'Hi {{customer_name}}!

We hope you loved your recent order from {{business_name}}!

Your Order: {{order_id}}
Order Date: {{order_date}}

Could you take 30 seconds to share your experience? 

Leave a review: {{review_url}}

Thank you for being an amazing customer!

Best regards,
The {{business_name}} Team',
  'transactional',
  'customer_engagement',
  true
),
(
  'order_status_update',
  'Order Status Update',
  'Order {{order_number}} - Status Update from {{business_name}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Status Update</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 40px 30px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; border-top: 1px solid #e9ecef; }
    .brand { font-size: 28px; font-weight: bold; margin: 0; }
    .order-details { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="brand">{{business_name}}</h1>
    </div>
    <div class="content">
      <h2>Hi {{customer_name}}! 👋</h2>
      <p>We have an update on your order:</p>
      <div class="order-details">
        <h3>Order #{{order_number}}</h3>
        <p><strong>Status:</strong> {{order_status}}</p>
        <p><strong>Order Total:</strong> ₦{{total_amount}}</p>
      </div>
      <p>Thank you for choosing {{business_name}}!</p>
    </div>
    <div class="footer">
      <p>This email was sent by {{business_name}}.</p>
    </div>
  </div>
</body>
</html>',
  'Hi {{customer_name}}!

We have an update on your order:

Order #{{order_number}}
Status: {{order_status}}
Order Total: ₦{{total_amount}}

Thank you for choosing {{business_name}}!',
  'transactional',
  'order_management',
  true
);