-- Create order completion email template (corrected without description column)
INSERT INTO enhanced_email_templates (
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
  'order_completed',
  'Order Completion Confirmation',
  'Order {{order_number}} - Completed Successfully! 🎉',
  '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Completed</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
        .order-details { background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .success-icon { font-size: 48px; margin-bottom: 10px; }
        .rating-section { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .btn { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .social-links { margin: 20px 0; }
        .social-links a { margin: 0 10px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="success-icon">✅</div>
            <h1>Order Completed!</h1>
            <p>Thank you for choosing us, {{customer_name}}!</p>
        </div>
        
        <div class="content">
            <p>Great news! Your order has been completed successfully.</p>
            
            <div class="order-details">
                <h3>Order Summary</h3>
                <p><strong>Order Number:</strong> {{order_number}}</p>
                <p><strong>Completion Date:</strong> {{completion_date}}</p>
                <p><strong>Total Amount:</strong> ₦{{total_amount}}</p>
                {{#if delivery_address}}
                <p><strong>Delivered To:</strong> {{delivery_address}}</p>
                {{/if}}
                {{#if pickup_location}}
                <p><strong>Picked up from:</strong> {{pickup_location}}</p>
                {{/if}}
            </div>

            <div class="rating-section">
                <h3>How was your experience? 🌟</h3>
                <p>We''d love to hear about your experience! Your feedback helps us serve you better.</p>
                <a href="{{review_link}}" class="btn">Leave a Review</a>
            </div>

            <h3>What''s Next?</h3>
            <ul>
                <li>✅ Your order is now complete</li>
                <li>🛍️ Browse our menu for your next order</li>
                <li>💝 Share your experience with friends</li>
                <li>🔔 Enable notifications for exclusive offers</li>
            </ul>

            <p><a href="{{menu_link}}" class="btn">Order Again</a></p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <h4>Need Help?</h4>
                <p>Our customer support team is here to help:</p>
                <ul>
                    <li>📧 Email: {{support_email}}</li>
                    <li>📱 Phone: {{support_phone}}</li>
                    <li>💬 WhatsApp: {{whatsapp_number}}</li>
                </ul>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>{{business_name}}</strong></p>
            <p>{{business_address}}</p>
            
            <div class="social-links">
                <a href="{{facebook_url}}">Facebook</a>
                <a href="{{instagram_url}}">Instagram</a>
                <a href="{{twitter_url}}">Twitter</a>
            </div>
            
            <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">
                Thank you for being a valued customer! 🙏
            </p>
        </div>
    </div>
</body>
</html>',
  'Hi {{customer_name}},

Great news! Your order {{order_number}} has been completed successfully! 🎉

Order Summary:
- Order Number: {{order_number}}
- Completion Date: {{completion_date}}
- Total Amount: ₦{{total_amount}}

We hope you enjoyed your order! We''d love to hear about your experience - please consider leaving us a review.

Order again: {{menu_link}}
Leave a review: {{review_link}}

Need help? Contact our support team:
- Email: {{support_email}}
- Phone: {{support_phone}}
- WhatsApp: {{whatsapp_number}}

Thank you for choosing {{business_name}}!

Best regards,
The {{business_name}} Team',
  'transactional',
  'Order Management',
  true,
  jsonb_build_object(
    'customer_name', 'Customer''s name',
    'order_number', 'Order number',
    'completion_date', 'Date/time when order was completed',
    'total_amount', 'Order total amount',
    'delivery_address', 'Delivery address (for delivery orders)',
    'pickup_location', 'Pickup location (for pickup orders)',
    'review_link', 'Link to leave a review',
    'menu_link', 'Link to browse menu',
    'support_email', 'Support email address',
    'support_phone', 'Support phone number',
    'whatsapp_number', 'WhatsApp support number',
    'business_name', 'Business name',
    'business_address', 'Business address',
    'facebook_url', 'Facebook page URL',
    'instagram_url', 'Instagram page URL',
    'twitter_url', 'Twitter page URL'
  )
) ON CONFLICT (template_key) DO UPDATE SET
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  variables = EXCLUDED.variables,
  updated_at = NOW();