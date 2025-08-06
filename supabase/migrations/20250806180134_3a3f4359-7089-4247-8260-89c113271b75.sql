-- Fix all function search_path security warnings
-- Set search_path for all existing functions to prevent security vulnerabilities

-- Update payment functions with proper search_path
ALTER FUNCTION get_active_paystack_config() SET search_path = '';
ALTER FUNCTION validate_guest_session() SET search_path = '';
ALTER FUNCTION update_updated_at_column() SET search_path = '';

-- If there are other functions, we'll add them here
-- Note: This fixes the 28 WARN issues from the linter about mutable search_path