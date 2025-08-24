-- Create/update email templates for native SMTP system
INSERT INTO enhanced_email_templates (template_key, template_name, subject_template, html_template, text_template, is_active, category) VALUES 
('customer_welcome', 'Customer Welcome Email', 
 'Welcome to {{companyName}}!', 
 '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to {{companyName}}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, {{primaryColor}}, {{secondaryColor}}); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">Welcome to {{companyName}}!</h1>
    </div>
    
    <div style="background: #fff; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
        <h2 style="color: {{primaryColor}};">Hello {{customerName}}!</h2>
        
        <p>Thank you for joining {{companyName}}! We are excited to have you as part of our community.</p>
        
        <p>Your account has been successfully verified and you can now:</p>
        <ul>
            <li>Browse our delicious menu of small chops</li>
            <li>Place orders for delivery or pickup</li>
            <li>Manage your profile and preferences</li>
            <li>Track your order history</li>
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{websiteUrl}}" style="background: {{primaryColor}}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Start Shopping</a>
        </div>
        
        <p>If you have any questions, feel free to reach out to us at <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p>
        
        <p>Best regards,<br>The {{companyName}} Team</p>
    </div>
    
    <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
        <p>&copy; 2024 {{companyName}}. All rights reserved.</p>
    </div>
</body>
</html>',
 'Welcome to {{companyName}}!

Hello {{customerName}},

Thank you for joining {{companyName}}! We are excited to have you as part of our community.

Your account has been successfully verified and you can now:
- Browse our delicious menu of small chops
- Place orders for delivery or pickup
- Manage your profile and preferences  
- Track your order history

Visit us at: {{websiteUrl}}

If you have any questions, contact us at {{supportEmail}}.

Best regards,
The {{companyName}} Team',
 true, 'customer'),

('purchase_receipt', 'Purchase Receipt', 
 'Your Order Receipt from {{companyName}} - Order #{{orderNumber}}',
 '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Receipt</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: {{primaryColor}}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">Order Receipt</h1>
        <p style="margin: 5px 0 0 0;">Order #{{orderNumber}}</p>
    </div>
    
    <div style="background: #fff; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
        <h2 style="color: {{primaryColor}};">Thank you, {{customerName}}!</h2>
        
        <p>Your order has been confirmed and will be prepared shortly.</p>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: {{primaryColor}};">Order Details</h3>
            <p><strong>Order Date:</strong> {{orderDate}}</p>
            <p><strong>Order Type:</strong> {{orderType}}</p>
            {{#if deliveryAddress}}<p><strong>Delivery Address:</strong> {{deliveryAddress}}</p>{{/if}}
            {{#if pickupPoint}}<p><strong>Pickup Location:</strong> {{pickupPoint}}</p>{{/if}}
        </div>
        
        <div style="margin: 20px 0;">
            <h3 style="color: {{primaryColor}};">Items Ordered</h3>
            {{orderItems}}
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: {{primaryColor}};">Payment Summary</h3>
            <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                <span>Subtotal:</span>
                <span>₦{{subtotal}}</span>
            </div>
            {{#if deliveryFee}}<div style="display: flex; justify-content: space-between; margin: 10px 0;">
                <span>Delivery Fee:</span>
                <span>₦{{deliveryFee}}</span>
            </div>{{/if}}
            <hr style="margin: 15px 0;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px;">
                <span>Total:</span>
                <span>₦{{totalAmount}}</span>
            </div>
        </div>
        
        <p>We will notify you when your order is ready for {{orderType}}.</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{websiteUrl}}/orders/{{orderNumber}}" style="background: {{primaryColor}}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Track Your Order</a>
        </div>
        
        <p>Questions? Contact us at <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p>
        
        <p>Best regards,<br>The {{companyName}} Team</p>
    </div>
</body>
</html>',
 'Order Receipt - {{companyName}}

Order #{{orderNumber}}

Thank you, {{customerName}}!

Your order has been confirmed and will be prepared shortly.

Order Details:
- Order Date: {{orderDate}}
- Order Type: {{orderType}}
{{#if deliveryAddress}}- Delivery Address: {{deliveryAddress}}{{/if}}
{{#if pickupPoint}}- Pickup Location: {{pickupPoint}}{{/if}}

Items Ordered:
{{orderItems}}

Payment Summary:
Subtotal: ₦{{subtotal}}
{{#if deliveryFee}}Delivery Fee: ₦{{deliveryFee}}{{/if}}
Total: ₦{{totalAmount}}

We will notify you when your order is ready.

Track your order: {{websiteUrl}}/orders/{{orderNumber}}

Questions? Contact us at {{supportEmail}}.

Best regards,
The {{companyName}} Team',
 true, 'order'),

('admin_status_update', 'Admin Order Status Update', 
 'Order Status Update - Order #{{orderNumber}} is now {{newStatus}}',
 '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Status Update</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: {{primaryColor}}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">Order Status Update</h1>
    </div>
    
    <div style="background: #fff; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
        <h2 style="color: {{primaryColor}};">Order #{{orderNumber}} Status Changed</h2>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Customer:</strong> {{customerName}} ({{customerEmail}})</p>
            <p><strong>Previous Status:</strong> {{oldStatus}}</p>
            <p><strong>New Status:</strong> {{newStatus}}</p>
            <p><strong>Updated By:</strong> {{updatedBy}}</p>
            <p><strong>Update Time:</strong> {{updateTime}}</p>
            {{#if notes}}<p><strong>Notes:</strong> {{notes}}</p>{{/if}}
        </div>
        
        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: {{primaryColor}};">Order Summary</h3>
            <p><strong>Total Amount:</strong> ₦{{totalAmount}}</p>
            <p><strong>Order Type:</strong> {{orderType}}</p>
            <p><strong>Order Date:</strong> {{orderDate}}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{websiteUrl}}/admin/orders/{{orderNumber}}" style="background: {{primaryColor}}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View Order Details</a>
        </div>
        
        <p>This is an automated notification from the {{companyName}} admin system.</p>
    </div>
</body>
</html>',
 'Order Status Update - {{companyName}}

Order #{{orderNumber}} Status Changed

Customer: {{customerName}} ({{customerEmail}})
Previous Status: {{oldStatus}}
New Status: {{newStatus}}
Updated By: {{updatedBy}}
Update Time: {{updateTime}}
{{#if notes}}Notes: {{notes}}{{/if}}

Order Summary:
- Total Amount: ₦{{totalAmount}}
- Order Type: {{orderType}}
- Order Date: {{orderDate}}

View details: {{websiteUrl}}/admin/orders/{{orderNumber}}

This is an automated notification from {{companyName}}.', 
 true, 'admin'),

('order_ready', 'Order Ready Notification', 
 'Your order is ready! - Order #{{orderNumber}}',
 '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Ready</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">🎉 Your Order is Ready!</h1>
    </div>
    
    <div style="background: #fff; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
        <h2 style="color: #10b981;">Hello {{customerName}}!</h2>
        
        <p>Great news! Your order #{{orderNumber}} is ready for {{orderType}}.</p>
        
        {{#if orderType == "pickup"}}
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #92400e;">Pickup Information</h3>
            <p><strong>Location:</strong> {{pickupAddress}}</p>
            <p><strong>Hours:</strong> {{pickupHours}}</p>
            <p><strong>Contact:</strong> {{pickupPhone}}</p>
        </div>
        {{/if}}
        
        {{#if orderType == "delivery"}}
        <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1e40af;">Delivery Information</h3>
            <p>Your order will be delivered to:</p>
            <p><strong>{{deliveryAddress}}</strong></p>
            {{#if estimatedDeliveryTime}}<p><strong>Estimated Delivery:</strong> {{estimatedDeliveryTime}}</p>{{/if}}
            {{#if deliveryInstructions}}<p><strong>Special Instructions:</strong> {{deliveryInstructions}}</p>{{/if}}
        </div>
        {{/if}}
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #6b7280;">Order Summary</h3>
            <p><strong>Order #:</strong> {{orderNumber}}</p>
            <p><strong>Total Amount:</strong> ₦{{totalAmount}}</p>
            <p><strong>Order Date:</strong> {{orderDate}}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{websiteUrl}}/orders/{{orderNumber}}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View Order Details</a>
        </div>
        
        <p>Thank you for choosing {{companyName}}! We hope you enjoy your order.</p>
        
        <p>Questions? Contact us at <a href="mailto:{{supportEmail}}">{{supportEmail}}</a> or call {{supportPhone}}.</p>
        
        <p>Best regards,<br>The {{companyName}} Team</p>
    </div>
</body>
</html>',
 'Your order is ready! - {{companyName}}

Hello {{customerName}},

Great news! Your order #{{orderNumber}} is ready for {{orderType}}.

{{#if orderType == "pickup"}}
Pickup Information:
- Location: {{pickupAddress}}
- Hours: {{pickupHours}}
- Contact: {{pickupPhone}}
{{/if}}

{{#if orderType == "delivery"}}
Delivery Information:
Your order will be delivered to: {{deliveryAddress}}
{{#if estimatedDeliveryTime}}Estimated Delivery: {{estimatedDeliveryTime}}{{/if}}
{{#if deliveryInstructions}}Special Instructions: {{deliveryInstructions}}{{/if}}
{{/if}}

Order Summary:
- Order #: {{orderNumber}}
- Total Amount: ₦{{totalAmount}}
- Order Date: {{orderDate}}

View details: {{websiteUrl}}/orders/{{orderNumber}}

Thank you for choosing {{companyName}}!

Questions? Contact us at {{supportEmail}} or call {{supportPhone}}.

Best regards,
The {{companyName}} Team',
 true, 'order')

ON CONFLICT (template_key) DO UPDATE SET
    template_name = EXCLUDED.template_name,
    subject_template = EXCLUDED.subject_template,
    html_template = EXCLUDED.html_template,
    text_template = EXCLUDED.text_template,
    is_active = EXCLUDED.is_active,
    category = EXCLUDED.category,
    updated_at = NOW();

-- Create trigger function for customer welcome after email verification
CREATE OR REPLACE FUNCTION public.trigger_welcome_email_after_verification()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger when email_confirmed_at changes from NULL to a timestamp
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    -- Find the customer account for this user
    INSERT INTO communication_events (
      event_type,
      recipient_email,
      template_key,
      email_type,
      status,
      variables,
      created_at
    )
    SELECT 
      'customer_welcome',
      NEW.email,
      'customer_welcome',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', COALESCE(ca.name, split_part(NEW.email, '@', 1)),
        'customerEmail', NEW.email,
        'verificationDate', NEW.email_confirmed_at::text
      ),
      NOW()
    FROM customer_accounts ca
    WHERE ca.user_id = NEW.id
    LIMIT 1;
    
    -- Fallback if no customer account found yet
    IF NOT FOUND THEN
      INSERT INTO communication_events (
        event_type,
        recipient_email,
        template_key,
        email_type,
        status,
        variables,
        created_at
      ) VALUES (
        'customer_welcome',
        NEW.email,
        'customer_welcome',
        'transactional',
        'queued',
        jsonb_build_object(
          'customerName', split_part(NEW.email, '@', 1),
          'customerEmail', NEW.email,
          'verificationDate', NEW.email_confirmed_at::text
        ),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on auth.users for welcome email
CREATE TRIGGER trigger_welcome_email_on_verification
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_welcome_email_after_verification();

-- Create trigger function for purchase receipts
CREATE OR REPLACE FUNCTION public.trigger_purchase_receipt()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  order_items_html TEXT;
  order_items_text TEXT;
  subtotal NUMERIC;
  delivery_fee NUMERIC := 0;
BEGIN
  -- Only trigger when payment status changes to 'paid'
  IF TG_OP = 'UPDATE' 
     AND OLD.payment_status IS DISTINCT FROM NEW.payment_status 
     AND NEW.payment_status = 'paid' THEN
    
    -- Build order items HTML and text
    SELECT 
      string_agg(
        '<div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee;">
          <div>
            <strong>' || oi.product_name || '</strong><br>
            <span style="color: #666;">Qty: ' || oi.quantity || ' × ₦' || oi.unit_price || '</span>
          </div>
          <div style="text-align: right; font-weight: bold;">₦' || oi.total_price || '</div>
        </div>', 
        ''
      ),
      string_agg(
        '- ' || oi.product_name || ' (Qty: ' || oi.quantity || ' × ₦' || oi.unit_price || ') = ₦' || oi.total_price, 
        E'\n'
      ),
      SUM(oi.total_price)
    INTO order_items_html, order_items_text, subtotal
    FROM order_items oi
    WHERE oi.order_id = NEW.id;
    
    -- Calculate delivery fee if delivery order
    IF NEW.order_type = 'delivery' THEN
      delivery_fee := COALESCE((NEW.delivery_address->>'delivery_fee')::NUMERIC, 0);
    END IF;
    
    -- Queue purchase receipt email
    INSERT INTO communication_events (
      order_id,
      event_type,
      recipient_email,
      template_key,
      email_type,
      status,
      variables,
      created_at
    ) VALUES (
      NEW.id,
      'purchase_receipt',
      NEW.customer_email,
      'purchase_receipt',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', NEW.customer_name,
        'orderNumber', NEW.order_number,
        'orderDate', NEW.order_time::text,
        'orderType', NEW.order_type,
        'deliveryAddress', CASE WHEN NEW.order_type = 'delivery' THEN 
          COALESCE(NEW.delivery_address->>'formatted_address', NEW.delivery_address::text) 
          ELSE NULL END,
        'pickupPoint', CASE WHEN NEW.order_type = 'pickup' THEN 
          (SELECT name FROM pickup_points WHERE id = NEW.pickup_point_id) 
          ELSE NULL END,
        'orderItems', COALESCE(order_items_html, 'No items found'),
        'subtotal', COALESCE(subtotal, 0)::text,
        'deliveryFee', CASE WHEN delivery_fee > 0 THEN delivery_fee::text ELSE NULL END,
        'totalAmount', NEW.total_amount::text
      ),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on orders for purchase receipts
CREATE TRIGGER trigger_purchase_receipt_on_payment
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_purchase_receipt();

-- Create trigger function for admin status updates
CREATE OR REPLACE FUNCTION public.trigger_admin_status_notification()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_emails TEXT[];
  admin_email TEXT;
BEGIN
  -- Only trigger when status changes (not on initial creation)
  IF TG_OP = 'UPDATE' 
     AND OLD.status IS DISTINCT FROM NEW.status 
     AND NEW.status IN ('confirmed', 'preparing', 'ready', 'completed', 'cancelled') THEN
    
    -- Get admin notification emails from business settings
    SELECT ARRAY[
      bs.admin_notification_email,
      bsd.admin_email
    ] INTO admin_emails
    FROM business_settings bs
    LEFT JOIN business_sensitive_data bsd ON true
    LIMIT 1;
    
    -- Send notification to each admin email
    FOREACH admin_email IN ARRAY admin_emails
    LOOP
      IF admin_email IS NOT NULL AND admin_email != '' THEN
        INSERT INTO communication_events (
          order_id,
          event_type,
          recipient_email,
          template_key,
          email_type,
          status,
          variables,
          created_at
        ) VALUES (
          NEW.id,
          'admin_status_update',
          admin_email,
          'admin_status_update',
          'transactional',
          'queued',
          jsonb_build_object(
            'orderNumber', NEW.order_number,
            'customerName', NEW.customer_name,
            'customerEmail', NEW.customer_email,
            'oldStatus', OLD.status,
            'newStatus', NEW.status,
            'updatedBy', COALESCE(
              (SELECT name FROM profiles WHERE id = auth.uid()),
              'System'
            ),
            'updateTime', NOW()::text,
            'totalAmount', NEW.total_amount::text,
            'orderType', NEW.order_type,
            'orderDate', NEW.order_time::text
          ),
          NOW()
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on orders for admin notifications
CREATE TRIGGER trigger_admin_status_notification_on_update
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_admin_status_notification();

-- Create trigger function for order ready notifications
CREATE OR REPLACE FUNCTION public.trigger_order_ready_notification()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pickup_info RECORD;
  business_info RECORD;
BEGIN
  -- Only trigger when status changes to 'ready'
  IF TG_OP = 'UPDATE' 
     AND OLD.status IS DISTINCT FROM NEW.status 
     AND NEW.status = 'ready' THEN
    
    -- Get business contact info
    SELECT 
      bs.name as company_name,
      bs.website_url,
      bsd.admin_email as support_email,
      bsd.admin_phone as support_phone
    INTO business_info
    FROM business_settings bs
    LEFT JOIN business_sensitive_data bsd ON true
    LIMIT 1;
    
    -- Get pickup point info if it's a pickup order
    IF NEW.order_type = 'pickup' AND NEW.pickup_point_id IS NOT NULL THEN
      SELECT 
        name,
        address,
        phone,
        business_hours
      INTO pickup_info
      FROM pickup_points 
      WHERE id = NEW.pickup_point_id;
    END IF;
    
    -- Queue order ready notification
    INSERT INTO communication_events (
      order_id,
      event_type,
      recipient_email,
      template_key,
      email_type,
      status,
      variables,
      created_at
    ) VALUES (
      NEW.id,
      'order_ready',
      NEW.customer_email,
      'order_ready',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', NEW.customer_name,
        'orderNumber', NEW.order_number,
        'orderType', NEW.order_type,
        'orderDate', NEW.order_time::text,
        'totalAmount', NEW.total_amount::text,
        'deliveryAddress', CASE WHEN NEW.order_type = 'delivery' THEN 
          COALESCE(NEW.delivery_address->>'formatted_address', NEW.delivery_address::text) 
          ELSE NULL END,
        'deliveryInstructions', CASE WHEN NEW.order_type = 'delivery' THEN 
          NEW.delivery_address->>'instructions'
          ELSE NULL END,
        'pickupAddress', pickup_info.address,
        'pickupHours', pickup_info.business_hours,
        'pickupPhone', pickup_info.phone,
        'supportPhone', business_info.support_phone
      ),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on orders for order ready notifications
CREATE TRIGGER trigger_order_ready_notification_on_status
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_order_ready_notification();