-- Fix email system production readiness issues

-- 1. Fix communication_events schema - add external_id column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'communication_events' 
    AND column_name = 'external_id'
  ) THEN
    ALTER TABLE communication_events ADD COLUMN external_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_communication_events_external_id ON communication_events(external_id);
  END IF;
END $$;

-- 2. Ensure email_suppression_list has correct schema
CREATE TABLE IF NOT EXISTS email_suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address TEXT NOT NULL,
  reason TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_suppression_list_email_address_key'
  ) THEN
    ALTER TABLE email_suppression_list 
    ADD CONSTRAINT email_suppression_list_email_address_key UNIQUE (email_address);
  END IF;
END $$;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_email_suppression_list_email_address ON email_suppression_list(email_address);

-- Enable RLS
ALTER TABLE email_suppression_list ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_suppression_list
DROP POLICY IF EXISTS "Admins can view email suppressions" ON email_suppression_list;
DROP POLICY IF EXISTS "Service role can manage email suppressions" ON email_suppression_list;

CREATE POLICY "Admins can view email suppressions" ON email_suppression_list
  FOR SELECT USING (is_admin());

CREATE POLICY "Service role can manage email suppressions" ON email_suppression_list
  FOR ALL USING (auth.role() = 'service_role');

-- 3. Seed essential email templates for production
INSERT INTO enhanced_email_templates (
  template_key, 
  subject_template, 
  html_template, 
  text_template, 
  template_type,
  is_active,
  created_at,
  updated_at
) VALUES 
-- Order confirmation template
('order_confirmation', 
 'Order Confirmation #{{order_number}}',
 '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Order Confirmed</title></head><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; text-align: center; margin-bottom: 20px;"><h1>{{business_name}}</h1></div><h2>Order Confirmed!</h2><p>Hi {{customer_name}},</p><p>Thank you for your order! Your order <strong>#{{order_number}}</strong> has been confirmed and is being prepared.</p><div style="background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;"><h3>Order Details:</h3><p><strong>Order Number:</strong> {{order_number}}</p><p><strong>Total Amount:</strong> ₦{{total_amount}}</p><p><strong>Order Type:</strong> {{order_type}}</p>{{#if delivery_address}}<p><strong>Delivery Address:</strong> {{delivery_address}}</p>{{/if}}{{#if pickup_point}}<p><strong>Pickup Location:</strong> {{pickup_point}}</p>{{/if}}</div><p>We''ll notify you when your order is ready!</p><p>Best regards,<br>{{business_name}} Team</p></body></html>',
 'Order Confirmed! Hi {{customer_name}}, your order #{{order_number}} has been confirmed. Total: ₦{{total_amount}}. We''ll notify you when it''s ready!',
 'standard',
 true,
 NOW(),
 NOW()),

-- Order ready/delivered template  
('order_delivered',
 'Your Order #{{order_number}} is Ready!',
 '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Order Ready</title></head><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; text-align: center; margin-bottom: 20px;"><h1>{{business_name}}</h1></div><h2>🎉 Your Order is Ready!</h2><p>Hi {{customer_name}},</p><p>Great news! Your order <strong>#{{order_number}}</strong> is now ready.</p><div style="background: #f0f9ff; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #10b981;"><h3>Next Steps:</h3>{{#if order_type_pickup}}<p>📍 <strong>Pickup Location:</strong> {{pickup_point}}</p><p>📞 <strong>Contact:</strong> {{pickup_phone}}</p><p>🕒 <strong>Hours:</strong> {{pickup_hours}}</p>{{/if}}{{#if order_type_delivery}}<p>🚚 Your order is out for delivery to: {{delivery_address}}</p>{{#if delivery_instructions}}<p>📝 <strong>Instructions:</strong> {{delivery_instructions}}</p>{{/if}}{{/if}}</div><p>Thank you for choosing {{business_name}}!</p><p>Best regards,<br>The {{business_name}} Team</p></body></html>',
 'Your order #{{order_number}} is ready! {{#if order_type_pickup}}Pickup at {{pickup_point}}{{/if}}{{#if order_type_delivery}}Out for delivery to {{delivery_address}}{{/if}}',
 'standard',
 true,
 NOW(),
 NOW()),

-- Order cancellation template
('order_cancellation',
 'Order #{{order_number}} Cancelled',
 '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Order Cancelled</title></head><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: #dc2626; color: white; padding: 20px; text-align: center; margin-bottom: 20px;"><h1>{{business_name}}</h1></div><h2>Order Cancelled</h2><p>Hi {{customer_name}},</p><p>We''re sorry to inform you that your order <strong>#{{order_number}}</strong> has been cancelled.</p><div style="background: #fef2f2; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #dc2626;"><p><strong>Cancellation Reason:</strong> {{cancellation_reason}}</p></div><p>If you have any questions, please contact us at {{admin_email}} or {{support_phone}}.</p><p>We apologize for any inconvenience.</p><p>Best regards,<br>{{business_name}} Team</p></body></html>',
 'Order #{{order_number}} has been cancelled. Reason: {{cancellation_reason}}. Contact us if you have questions.',
 'standard',
 true,
 NOW(),
 NOW()),

-- Shipping notification template
('shipping_notification',
 'Order #{{order_number}} is Out for Delivery',
 '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Out for Delivery</title></head><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 20px; text-align: center; margin-bottom: 20px;"><h1>{{business_name}}</h1></div><h2>🚚 Out for Delivery!</h2><p>Hi {{customer_name}},</p><p>Your order <strong>#{{order_number}}</strong> is now out for delivery!</p><div style="background: #eff6ff; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #3b82f6;"><h3>Delivery Details:</h3><p><strong>Delivery Address:</strong> {{delivery_address}}</p>{{#if delivery_instructions}}<p><strong>Special Instructions:</strong> {{delivery_instructions}}</p>{{/if}}<p><strong>Estimated Delivery:</strong> {{estimated_delivery_time}}</p></div><p>Please ensure someone is available to receive your order.</p><p>Best regards,<br>{{business_name}} Team</p></body></html>',
 'Your order #{{order_number}} is out for delivery to {{delivery_address}}. Estimated delivery: {{estimated_delivery_time}}',
 'standard',
 true,
 NOW(),
 NOW())

ON CONFLICT (template_key) DO UPDATE SET
  subject_template = EXCLUDED.subject_template,
  html_template = EXCLUDED.html_template,
  text_template = EXCLUDED.text_template,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 4. Create/update trigger for order status changes to queue emails
CREATE OR REPLACE FUNCTION trigger_order_status_email_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_template_key TEXT;
  v_business_name TEXT := 'Starters Small Chops';
  v_admin_email TEXT;
  v_support_phone TEXT;
  v_pickup_info JSONB;
BEGIN
  -- Only process status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Get business info
    SELECT name, admin_notification_email, whatsapp_support_number
    INTO v_business_name, v_admin_email, v_support_phone
    FROM business_settings
    ORDER BY created_at ASC LIMIT 1;
    
    -- Map status to template
    CASE NEW.status
      WHEN 'confirmed' THEN v_template_key := 'order_confirmation';
      WHEN 'out_for_delivery' THEN v_template_key := 'shipping_notification';
      WHEN 'ready' THEN v_template_key := 'order_delivered';
      WHEN 'delivered' THEN v_template_key := 'order_delivered';
      WHEN 'cancelled' THEN v_template_key := 'order_cancellation';
      ELSE v_template_key := NULL;
    END CASE;
    
    -- Get pickup info if needed
    IF NEW.order_type = 'pickup' AND NEW.pickup_point_id IS NOT NULL THEN
      SELECT jsonb_build_object(
        'name', name,
        'address', address,
        'phone', contact_phone,
        'hours', operating_hours
      ) INTO v_pickup_info
      FROM pickup_points 
      WHERE id = NEW.pickup_point_id;
    END IF;
    
    -- Queue email if template exists
    IF v_template_key IS NOT NULL AND NEW.customer_email IS NOT NULL THEN
      INSERT INTO communication_events (
        order_id,
        event_type,
        recipient_email,
        template_key,
        email_type,
        status,
        priority,
        variables,
        created_at,
        scheduled_at
      ) VALUES (
        NEW.id,
        'order_status_update',
        NEW.customer_email,
        v_template_key,
        'transactional',
        'queued',
        'high',
        jsonb_build_object(
          'customer_name', NEW.customer_name,
          'order_number', NEW.order_number,
          'order_type', NEW.order_type,
          'total_amount', NEW.total_amount::text,
          'business_name', COALESCE(v_business_name, 'Starters Small Chops'),
          'admin_email', v_admin_email,
          'support_phone', v_support_phone,
          'delivery_address', CASE 
            WHEN NEW.order_type = 'delivery' THEN 
              COALESCE(NEW.delivery_address->>'formatted_address', NEW.delivery_address::text)
            ELSE NULL 
          END,
          'delivery_instructions', CASE 
            WHEN NEW.order_type = 'delivery' THEN 
              NEW.delivery_address->>'instructions'
            ELSE NULL 
          END,
          'pickup_point', CASE 
            WHEN NEW.order_type = 'pickup' THEN v_pickup_info->>'name'
            ELSE NULL 
          END,
          'pickup_address', CASE 
            WHEN NEW.order_type = 'pickup' THEN v_pickup_info->>'address'
            ELSE NULL 
          END,
          'pickup_phone', CASE 
            WHEN NEW.order_type = 'pickup' THEN v_pickup_info->>'phone'
            ELSE NULL 
          END,
          'pickup_hours', CASE 
            WHEN NEW.order_type = 'pickup' THEN v_pickup_info->>'hours'
            ELSE NULL 
          END,
          'order_type_pickup', (NEW.order_type = 'pickup'),
          'order_type_delivery', (NEW.order_type = 'delivery'),
          'cancellation_reason', CASE 
            WHEN NEW.status = 'cancelled' THEN 
              COALESCE(NEW.admin_notes, 'Administrative decision')
            ELSE NULL 
          END,
          'estimated_delivery_time', CASE 
            WHEN NEW.status = 'out_for_delivery' THEN 
              COALESCE(NEW.delivery_time::text, 'Soon')
            ELSE NULL 
          END
        ),
        NOW(),
        NOW()
      );
      
      -- Log the email queuing
      INSERT INTO audit_logs (
        action,
        category, 
        message,
        entity_id,
        new_values
      ) VALUES (
        'order_email_queued',
        'Email Processing',
        'Queued ' || v_template_key || ' email for order ' || NEW.order_number,
        NEW.id,
        jsonb_build_object(
          'template_key', v_template_key,
          'recipient', NEW.customer_email,
          'order_status', NEW.status
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;