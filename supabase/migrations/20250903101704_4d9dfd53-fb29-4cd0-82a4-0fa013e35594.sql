-- Production Email Template Audit: Remove non-functional templates

-- First, delete all inactive templates (these are already disabled)
DELETE FROM enhanced_email_templates WHERE is_active = false;

-- Remove redundant/unused active templates that have no production usage
DELETE FROM enhanced_email_templates WHERE template_key IN (
  -- Cart abandonment duplicates (keep abandoned_cart_recovery, remove cart_abandonment)
  'cart_abandonment',
  
  -- Admin notification duplicates (keep admin_new_order, remove admin_order_notification)  
  'admin_order_notification',
  
  -- Order status duplicates (keep specific status templates, remove generic order_status_update)
  'order_status_update',
  
  -- Registration duplicates (keep customer_registration_otp, remove registration_otp)
  'registration_otp',
  
  -- Payment duplicates (keep payment_confirmation, remove purchase_receipt)  
  'purchase_receipt',
  
  -- Unused marketing templates with no production integration
  'promotional_announcement',
  'promotional_flash_sale', 
  'welcome_series_day1',
  
  -- Unused order status templates (no production workflows)
  'order_cancelled',
  'order_completed',
  'order_out_for_delivery', 
  'order_returned',
  
  -- Unused authentication templates (no integration found)
  'password_reset',
  'password_reset_otp',
  
  -- Unused feature templates
  'review_request',
  'admin_invitation'
);

-- Log the cleanup action
INSERT INTO audit_logs (
  action,
  category, 
  message,
  user_id,
  new_values
) VALUES (
  'email_template_production_audit',
  'Email Management',
  'Production email template audit completed - removed non-functional templates',
  auth.uid(),
  jsonb_build_object(
    'cleanup_type', 'production_audit',
    'templates_removed', 'inactive_and_unused_templates',
    'remaining_functional', 'core_production_templates_only'
  )
);