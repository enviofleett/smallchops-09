-- Fix all 9 invalid email templates for production readiness
-- Using correct text[] array syntax instead of jsonb

-- Fix 1: pickup_ready - Add missing variables
UPDATE enhanced_email_templates
SET 
  variables = ARRAY['customer_name', 'order_number', 'business_name']::text[],
  full_html = true,
  updated_at = now()
WHERE template_key = 'pickup_ready';

-- Fix 2: order_confirmation - Remove conditionals and fix variables
UPDATE enhanced_email_templates
SET 
  variables = ARRAY['business_name', 'customer_name', 'order_number', 'total_amount', 'order_type', 'delivery_address', 'pickup_point']::text[],
  html_template = regexp_replace(
    regexp_replace(html_template, '\{\{#if [^}]+\}\}', '', 'g'),
    '\{\{/if\}\}', '', 'g'
  ),
  full_html = true,
  updated_at = now()
WHERE template_key = 'order_confirmation';

-- Fix 3: smtp_connection_test - Add missing timestamp variable
UPDATE enhanced_email_templates
SET 
  variables = ARRAY['timestamp']::text[],
  full_html = true,
  updated_at = now()
WHERE template_key = 'smtp_connection_test';

-- Fix 4: customer_registration_otp - Add all OTP variables
UPDATE enhanced_email_templates
SET 
  variables = ARRAY['primaryColor', 'companyName', 'customerName', 'otpCode', 'expiryMinutes', 'websiteUrl', 'supportEmail']::text[],
  full_html = true,
  updated_at = now()
WHERE template_key = 'customer_registration_otp';

-- Fix 5: order_cancellation - Add all cancellation variables
UPDATE enhanced_email_templates
SET 
  variables = ARRAY['business_name', 'customer_name', 'order_number', 'cancellation_reason', 'admin_email', 'support_phone']::text[],
  full_html = true,
  updated_at = now()
WHERE template_key = 'order_cancellation';

-- Fix 6: shipping_notification - Remove conditionals and fix variables
UPDATE enhanced_email_templates
SET 
  variables = ARRAY['business_name', 'customer_name', 'order_number', 'delivery_address', 'delivery_instructions', 'estimated_delivery_time']::text[],
  html_template = regexp_replace(
    regexp_replace(html_template, '\{\{#if [^}]+\}\}', '', 'g'),
    '\{\{/if\}\}', '', 'g'
  ),
  full_html = true,
  updated_at = now()
WHERE template_key = 'shipping_notification';

-- Fix 7: admin_status_update - Remove conditionals and add all variables
UPDATE enhanced_email_templates
SET 
  variables = ARRAY['primaryColor', 'orderNumber', 'customerName', 'customerEmail', 'oldStatus', 'newStatus', 'updatedBy', 'updateTime', 'notes', 'totalAmount', 'orderType', 'orderDate', 'websiteUrl', 'companyName']::text[],
  html_template = regexp_replace(
    regexp_replace(html_template, '\{\{#if [^}]+\}\}', '', 'g'),
    '\{\{/if\}\}', '', 'g'
  ),
  full_html = true,
  updated_at = now()
WHERE template_key = 'admin_status_update';

-- Fix 8: review_request - Add all review request variables
UPDATE enhanced_email_templates
SET 
  variables = ARRAY['business_name', 'customer_name', 'order_id', 'order_date', 'review_url', 'unsubscribe_url']::text[],
  full_html = true,
  updated_at = now()
WHERE template_key = 'review_request';

-- Fix 9: order_status_update - Add all status update variables
UPDATE enhanced_email_templates
SET 
  variables = ARRAY['business_name', 'customer_name', 'order_number', 'order_status', 'total_amount']::text[],
  full_html = true,
  updated_at = now()
WHERE template_key = 'order_status_update';

-- Audit log for tracking
INSERT INTO audit_logs (action, category, message, new_values)
VALUES (
  'email_templates_production_fix',
  'Email System',
  'Fixed 9 email templates for production: declared all variables, removed Handlebars conditionals, enabled full_html',
  jsonb_build_object(
    'fixed_templates', jsonb_build_array(
      'pickup_ready',
      'order_confirmation',
      'smtp_connection_test',
      'customer_registration_otp',
      'order_cancellation',
      'shipping_notification',
      'admin_status_update',
      'review_request',
      'order_status_update'
    ),
    'changes', jsonb_build_object(
      'variables_declared', true,
      'conditionals_removed', true,
      'full_html_enabled', true
    )
  )
);