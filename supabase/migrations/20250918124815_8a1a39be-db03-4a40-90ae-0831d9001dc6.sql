-- Create missing email templates for order status updates
INSERT INTO enhanced_email_templates (template_key, subject, html_body, variables, is_active, created_at, updated_at)
VALUES 
  ('order_confirmed', 'Order Confirmed - {{order_number}}', 
   '<h2>Order Confirmed!</h2>
    <p>Hi {{customer_name}},</p>
    <p>Your order <strong>{{order_number}}</strong> has been confirmed and is being prepared.</p>
    <p>Status: <strong>{{status_display}}</strong></p>
    <p>We''ll keep you updated on your order progress.</p>
    <p>Thank you for choosing us!</p>', 
   '["customer_name", "order_number", "status_display"]'::jsonb, 
   true, now(), now()),
   
  ('order_preparing', 'Order Being Prepared - {{order_number}}', 
   '<h2>Your Order is Being Prepared</h2>
    <p>Hi {{customer_name}},</p>
    <p>Great news! Your order <strong>{{order_number}}</strong> is now being prepared by our team.</p>
    <p>Status: <strong>{{status_display}}</strong></p>
    <p>We''ll notify you once it''s ready for delivery.</p>', 
   '["customer_name", "order_number", "status_display"]'::jsonb, 
   true, now(), now()),
   
  ('order_ready', 'Order Ready for Delivery - {{order_number}}', 
   '<h2>Order Ready!</h2>
    <p>Hi {{customer_name}},</p>
    <p>Your order <strong>{{order_number}}</strong> is ready and will be delivered soon!</p>
    <p>Status: <strong>{{status_display}}</strong></p>
    <p>Our delivery team will be in touch shortly.</p>', 
   '["customer_name", "order_number", "status_display"]'::jsonb, 
   true, now(), now()),
   
  ('order_out_for_delivery', 'Order Out for Delivery - {{order_number}}', 
   '<h2>Your Order is On the Way!</h2>
    <p>Hi {{customer_name}},</p>
    <p>Your order <strong>{{order_number}}</strong> is now out for delivery!</p>
    <p>Status: <strong>{{status_display}}</strong></p>
    <p>Please be available to receive your order.</p>', 
   '["customer_name", "order_number", "status_display"]'::jsonb, 
   true, now(), now()),
   
  ('order_delivered', 'Order Delivered - {{order_number}}', 
   '<h2>Order Delivered Successfully!</h2>
    <p>Hi {{customer_name}},</p>
    <p>Your order <strong>{{order_number}}</strong> has been delivered successfully!</p>
    <p>Status: <strong>{{status_display}}</strong></p>
    <p>We hope you enjoy your meal. Thank you for choosing us!</p>', 
   '["customer_name", "order_number", "status_display"]'::jsonb, 
   true, now(), now()),
   
  ('order_cancelled', 'Order Cancelled - {{order_number}}', 
   '<h2>Order Cancelled</h2>
    <p>Hi {{customer_name}},</p>
    <p>Your order <strong>{{order_number}}</strong> has been cancelled.</p>
    <p>Status: <strong>{{status_display}}</strong></p>
    <p>If you have any questions, please contact our support team.</p>', 
   '["customer_name", "order_number", "status_display"]'::jsonb, 
   true, now(), now())
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_body = EXCLUDED.html_body,
  variables = EXCLUDED.variables,
  updated_at = now();