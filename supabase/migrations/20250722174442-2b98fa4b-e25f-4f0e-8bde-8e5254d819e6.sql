
-- Drop all settings-related tables and their dependencies
DROP TABLE IF EXISTS public.user_permissions CASCADE;
DROP TABLE IF EXISTS public.business_settings CASCADE;
DROP TABLE IF EXISTS public.communication_settings CASCADE;
DROP TABLE IF EXISTS public.communication_events CASCADE;
DROP TABLE IF EXISTS public.communication_logs CASCADE;
DROP TABLE IF EXISTS public.payment_integrations CASCADE;
DROP TABLE IF EXISTS public.shipping_integrations CASCADE;
DROP TABLE IF EXISTS public.map_settings CASCADE;
DROP TABLE IF EXISTS public.map_api_usage CASCADE;
DROP TABLE IF EXISTS public.customer_communication_preferences CASCADE;
DROP TABLE IF EXISTS public.content_management CASCADE;
DROP TABLE IF EXISTS public.vehicle_assignments CASCADE;
DROP TABLE IF EXISTS public.vehicles CASCADE;

-- Drop custom types that were used by settings tables
DROP TYPE IF EXISTS public.menu_section CASCADE;
DROP TYPE IF EXISTS public.permission_level CASCADE;
DROP TYPE IF EXISTS public.communication_event_status CASCADE;
DROP TYPE IF EXISTS public.communication_log_status CASCADE;
DROP TYPE IF EXISTS public.assignment_status CASCADE;
DROP TYPE IF EXISTS public.vehicle_status CASCADE;
DROP TYPE IF EXISTS public.vehicle_type CASCADE;

-- Drop settings-related functions
DROP FUNCTION IF EXISTS public.log_settings_changes() CASCADE;
DROP FUNCTION IF EXISTS public.validate_business_settings() CASCADE;

-- Remove storage buckets for settings
DELETE FROM storage.buckets WHERE id IN ('business-logos', 'category-banners');

-- Clean up any triggers that might reference deleted functions
DROP TRIGGER IF EXISTS log_business_settings_changes ON public.business_settings;
DROP TRIGGER IF EXISTS log_communication_settings_changes ON public.communication_settings;
DROP TRIGGER IF EXISTS log_payment_integrations_changes ON public.payment_integrations;
DROP TRIGGER IF EXISTS validate_business_settings_trigger ON public.business_settings;
