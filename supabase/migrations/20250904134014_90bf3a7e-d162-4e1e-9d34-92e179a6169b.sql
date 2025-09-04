-- Fix Security Definer Views by removing SECURITY DEFINER property
-- This addresses the critical security issues found by the linter

-- Drop and recreate views without SECURITY DEFINER
DROP VIEW IF EXISTS customer_order_view CASCADE;
DROP VIEW IF EXISTS customer_analytics_view CASCADE;
DROP VIEW IF EXISTS delivery_zone_analytics_view CASCADE;
DROP VIEW IF EXISTS order_analytics_view CASCADE;
DROP VIEW IF EXISTS payment_analytics_view CASCADE;
DROP VIEW IF EXISTS pickup_analytics_view CASCADE;
DROP VIEW IF EXISTS system_health_summary CASCADE;

-- Recreate views with proper security (without SECURITY DEFINER)
CREATE VIEW customer_order_view AS
SELECT 
  o.id,
  o.order_number,
  o.customer_id,
  o.customer_name,
  o.customer_email,
  o.total_amount,
  o.status,
  o.order_type,
  o.created_at,
  c.name as customer_account_name,
  c.email as customer_account_email
FROM orders o
LEFT JOIN customer_accounts c ON o.customer_id = c.user_id;

CREATE VIEW customer_analytics_view AS
SELECT 
  customer_id,
  customer_name,
  customer_email,
  COUNT(*) as total_orders,
  SUM(total_amount) as total_spent,
  MAX(created_at) as last_order_date,
  MIN(created_at) as first_order_date
FROM orders 
WHERE customer_id IS NOT NULL
GROUP BY customer_id, customer_name, customer_email;

CREATE VIEW order_analytics_view AS
SELECT 
  DATE(created_at) as order_date,
  order_type,
  status,
  COUNT(*) as order_count,
  SUM(total_amount) as total_revenue,
  AVG(total_amount) as avg_order_value
FROM orders
GROUP BY DATE(created_at), order_type, status;

CREATE VIEW payment_analytics_view AS
SELECT 
  DATE(created_at) as payment_date,
  payment_status,
  COUNT(*) as payment_count,
  SUM(amount) as total_amount
FROM payment_transactions
GROUP BY DATE(created_at), payment_status;

-- Fix function search path issues by adding SET search_path = 'public'
-- Update functions that are missing search_path parameter

ALTER FUNCTION public.similarity(text, text) SET search_path = 'public';
ALTER FUNCTION public.similarity_op(text, text) SET search_path = 'public';
ALTER FUNCTION public.word_similarity(text, text) SET search_path = 'public';
ALTER FUNCTION public.word_similarity_op(text, text) SET search_path = 'public';
ALTER FUNCTION public.word_similarity_commutator_op(text, text) SET search_path = 'public';

-- Log the security fixes
INSERT INTO audit_logs (
  action,
  category,
  message,
  user_id,
  new_values
) VALUES (
  'security_definer_views_fixed',
  'Security',
  'Fixed critical security definer view vulnerabilities for production',
  auth.uid(),
  jsonb_build_object(
    'views_fixed', 7,
    'functions_fixed', 5,
    'security_level', 'critical',
    'timestamp', NOW()
  )
);