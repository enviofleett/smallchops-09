-- Ensure payment_confirmation template exists
INSERT INTO enhanced_email_templates (
  template_key,
  template_name,
  subject_template,
  html_template,
  text_template,
  variable_schema,
  is_active,
  created_by
) VALUES (
  'payment_confirmation',
  'Payment Confirmation',
  'Payment Confirmation for Order {{order_number}}',
  '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Payment Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #333;">Payment Confirmed!</h1>
    </div>
    
    <p>Dear {{customer_name}},</p>
    
    <p>Thank you for your payment! We have successfully received your payment for order <strong>{{order_number}}</strong>.</p>
    
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Order Details:</h3>
        <p><strong>Order Number:</strong> {{order_number}}</p>
        <p><strong>Amount Paid:</strong> {{amount}}</p>
        <p><strong>Payment Reference:</strong> {{payment_reference}}</p>
    </div>
    
    <p>Your order is now being processed and you will receive another email when it''s ready for delivery/pickup.</p>
    
    <p>Thank you for choosing us!</p>
    
    <p>Best regards,<br>The Team</p>
</body>
</html>',
  'Dear {{customer_name}},

Thank you for your payment! We have successfully received your payment for order {{order_number}}.

Order Details:
- Order Number: {{order_number}}
- Amount Paid: {{amount}}
- Payment Reference: {{payment_reference}}

Your order is now being processed and you will receive another email when it''s ready for delivery/pickup.

Thank you for choosing us!

Best regards,
The Team',
  jsonb_build_object(
    'customer_name', jsonb_build_object('type', 'string', 'required', true, 'description', 'Customer name'),
    'customerName', jsonb_build_object('type', 'string', 'required', false, 'description', 'Customer name (alias)'),
    'order_number', jsonb_build_object('type', 'string', 'required', true, 'description', 'Order number'),
    'order_id', jsonb_build_object('type', 'string', 'required', true, 'description', 'Order ID'),
    'amount', jsonb_build_object('type', 'string', 'required', true, 'description', 'Formatted payment amount'),
    'payment_reference', jsonb_build_object('type', 'string', 'required', true, 'description', 'Payment reference/method')
  ),
  true,
  (SELECT id FROM profiles WHERE is_admin = true LIMIT 1)
) ON CONFLICT (template_key) DO UPDATE SET
  variable_schema = EXCLUDED.variable_schema,
  updated_at = NOW();

-- Add monitoring helper view for admins
CREATE OR REPLACE VIEW email_monitoring_summary AS
SELECT 
  DATE(created_at) as date,
  event_type,
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as last_24h_count
FROM communication_events 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at), event_type, status
ORDER BY date DESC, event_type, status;