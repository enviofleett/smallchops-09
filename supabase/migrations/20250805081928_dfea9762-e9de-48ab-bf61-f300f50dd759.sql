-- Insert additional email templates with correct template types
INSERT INTO enhanced_email_templates (template_key, template_name, subject_template, html_template, text_template, variables, template_type, is_active)
VALUES 
  ('password_reset', 'Password Reset', 'Reset Your Password - {{store_name}}', 
   '<h1>Password Reset Request</h1>
    <p>Hello {{customer_name}},</p>
    <p>We received a request to reset your password for your {{store_name}} account.</p>
    <p><a href="{{reset_link}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
    <p>If you did not request this password reset, please ignore this email.</p>
    <p>This link will expire in 24 hours for security reasons.</p>
    <p>Best regards,<br>The {{store_name}} Team</p>',
   'Password Reset Request\n\nHello {{customer_name}},\n\nWe received a request to reset your password. Click the link below to reset it:\n{{reset_link}}\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nThe {{store_name}} Team',
   ARRAY['customer_name', 'store_name', 'reset_link'],
   'transactional', true),
   
  ('order_status_update', 'Order Status Update', 'Order {{order_number}} Status Update - {{new_status}}',
   '<h1>Order Status Update</h1>
    <p>Hello {{customer_name}},</p>
    <p>Your order <strong>{{order_number}}</strong> status has been updated to: <strong>{{new_status}}</strong></p>
    <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <h3>Order Details:</h3>
      <p><strong>Order Number:</strong> {{order_number}}</p>
      <p><strong>Total Amount:</strong> {{order_total}}</p>
      <p><strong>Current Status:</strong> {{new_status}}</p>
      {{#tracking_number}}<p><strong>Tracking Number:</strong> {{tracking_number}}</p>{{/tracking_number}}
    </div>
    <p>You can track your order status online at any time.</p>
    <p>Thank you for choosing {{store_name}}!</p>',
   'Order Status Update\n\nHello {{customer_name}},\n\nYour order {{order_number}} status: {{new_status}}\nTotal: {{order_total}}\n\nThank you for choosing {{store_name}}!',
   ARRAY['customer_name', 'order_number', 'order_total', 'new_status', 'tracking_number', 'store_name'],
   'transactional', true),
   
  ('abandoned_cart_recovery', 'Complete Your Purchase', 'Don''t forget your items at {{store_name}}!',
   '<h1>Complete Your Purchase</h1>
    <p>Hello {{customer_name}},</p>
    <p>You left some great items in your cart at {{store_name}}. Don''t miss out!</p>
    <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <h3>Items in your cart:</h3>
      <p>{{cart_items}}</p>
      <p><strong>Total Value:</strong> {{cart_total}}</p>
    </div>
    <p><a href="{{checkout_link}}" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Complete Your Purchase</a></p>
    <p>This cart will be saved for 7 days.</p>
    <p>Happy shopping!</p>',
   'Complete Your Purchase\n\nHello {{customer_name}},\n\nYou have items waiting in your cart:\n{{cart_items}}\nTotal: {{cart_total}}\n\nComplete your purchase: {{checkout_link}}\n\nHappy shopping!',
   ARRAY['customer_name', 'store_name', 'cart_items', 'cart_total', 'checkout_link'],
   'marketing', true),
   
  ('admin_new_order', 'New Order Received', 'New Order Alert - {{order_number}}',
   '<h1>New Order Received</h1>
    <p>A new order has been placed on {{store_name}}.</p>
    <div style="background: #e3f2fd; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <h3>Order Details:</h3>
      <p><strong>Order Number:</strong> {{order_number}}</p>
      <p><strong>Customer:</strong> {{customer_name}} ({{customer_email}})</p>
      <p><strong>Phone:</strong> {{customer_phone}}</p>
      <p><strong>Total Amount:</strong> {{order_total}}</p>
      <p><strong>Order Type:</strong> {{fulfillment_type}}</p>
      <p><strong>Payment Status:</strong> {{payment_status}}</p>
    </div>
    <p>Please review and process this order promptly.</p>
    <p><a href="{{admin_order_link}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Order</a></p>',
   'New Order Alert\n\nOrder: {{order_number}}\nCustomer: {{customer_name}} ({{customer_email}})\nPhone: {{customer_phone}}\nTotal: {{order_total}}\nType: {{fulfillment_type}}\nPayment: {{payment_status}}\n\nPlease process promptly.',
   ARRAY['store_name', 'order_number', 'customer_name', 'customer_email', 'customer_phone', 'order_total', 'fulfillment_type', 'payment_status', 'admin_order_link'],
   'admin', true),
   
  ('promotional_announcement', 'Special Offer', '{{promotion_title}} - {{store_name}}',
   '<h1>{{promotion_title}}</h1>
    <p>Hello {{customer_name}},</p>
    <p>{{promotion_description}}</p>
    <div style="background: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #ffc107;">
      <h3>Offer Details:</h3>
      <p><strong>Discount:</strong> {{discount_amount}}</p>
      <p><strong>Valid Until:</strong> {{expiry_date}}</p>
      {{#promo_code}}<p><strong>Promo Code:</strong> {{promo_code}}</p>{{/promo_code}}
    </div>
    <p><a href="{{shop_link}}" style="background: #ffc107; color: #212529; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Shop Now</a></p>
    <p>Happy shopping at {{store_name}}!</p>',
   'Special Offer - {{promotion_title}}\n\nHello {{customer_name}},\n\n{{promotion_description}}\n\nDiscount: {{discount_amount}}\nValid Until: {{expiry_date}}\nPromo Code: {{promo_code}}\n\nShop now: {{shop_link}}',
   ARRAY['customer_name', 'store_name', 'promotion_title', 'promotion_description', 'discount_amount', 'expiry_date', 'promo_code', 'shop_link'],
   'marketing', true)

ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  variables = EXCLUDED.variables,
  template_type = EXCLUDED.template_type,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();