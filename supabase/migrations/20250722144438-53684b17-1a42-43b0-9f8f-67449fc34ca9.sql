-- Fix remaining function search path issue

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
DECLARE
  admin_count INTEGER;
  new_user_role public.user_role;
BEGIN
  -- Lock table to prevent race condition
  LOCK TABLE public.profiles IN EXCLUSIVE MODE;

  -- Check if any admin users exist
  SELECT count(*) INTO admin_count FROM public.profiles WHERE role = 'admin';

  -- If no admins exist, make this user an admin
  IF admin_count = 0 THEN
    new_user_role := 'admin';
  ELSE
    new_user_role := 'staff';
  END IF;

  -- Insert new profile
  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', new_user_role);
  
  RETURN NEW;
END;
$$;

-- Phase 3: Business Intelligence & Settings Tables

-- 1. Business Settings & Configuration

-- Create business settings table
CREATE TABLE public.business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  address TEXT,
  phone TEXT,
  working_hours TEXT,
  logo_url TEXT,
  registration_number TEXT,
  tax_id TEXT,
  licenses TEXT,
  social_links JSONB,
  business_hours JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payment integrations table
CREATE TABLE public.payment_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  public_key TEXT,
  secret_key TEXT,
  mode TEXT, -- 'test' or 'live'
  webhook_url TEXT,
  currency TEXT DEFAULT 'NGN',
  transaction_fee NUMERIC,
  payment_methods JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  connection_status TEXT
);

-- Create communication settings table
CREATE TABLE public.communication_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sms_provider TEXT,
  sms_api_key TEXT,
  sms_sender_id TEXT,
  sms_templates JSONB,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_pass TEXT,
  email_templates JSONB,
  sender_email TEXT,
  enable_sms BOOLEAN DEFAULT false,
  enable_email BOOLEAN DEFAULT false,
  triggers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create map settings table
CREATE TABLE public.map_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  monthly_usage_limit INTEGER,
  usage_alert_email TEXT,
  usage_alert_threshold INTEGER CHECK (usage_alert_threshold >= 0 AND usage_alert_threshold <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton_map_settings CHECK (id = 1)
);

-- Create map API usage tracking table
CREATE TABLE public.map_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  feature_used TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  count INTEGER NOT NULL DEFAULT 1
);

-- Create content management table
CREATE TABLE public.content_management (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  title TEXT,
  content TEXT,
  content_type TEXT DEFAULT 'html',
  version INTEGER DEFAULT 1,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. User Permissions System

-- Create menu section enum
CREATE TYPE public.menu_section AS ENUM (
  'dashboard',
  'orders', 
  'categories',
  'products',
  'customers',
  'delivery_pickup',
  'promotions',
  'reports',
  'settings',
  'audit_logs'
);

-- Create permission level enum
CREATE TYPE public.permission_level AS ENUM (
  'none',
  'view',
  'edit'
);

-- Create user permissions table
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  menu_section public.menu_section NOT NULL,
  permission_level public.permission_level NOT NULL DEFAULT 'none',
  UNIQUE(user_id, menu_section)
);

-- Add updated_at triggers
CREATE TRIGGER handle_updated_at_business_settings
BEFORE UPDATE ON public.business_settings
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

CREATE TRIGGER handle_updated_at_payment_integrations
BEFORE UPDATE ON public.payment_integrations
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

CREATE TRIGGER handle_updated_at_communication_settings
BEFORE UPDATE ON public.communication_settings
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

CREATE TRIGGER handle_updated_at_map_settings
BEFORE UPDATE ON public.map_settings
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

CREATE TRIGGER handle_updated_at_content_management
BEFORE UPDATE ON public.content_management
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- Enable RLS on new tables
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business settings
CREATE POLICY "Admins can manage business settings"
ON public.business_settings FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- RLS Policies for payment integrations
CREATE POLICY "Admins can manage payment integrations"
ON public.payment_integrations FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- RLS Policies for communication settings
CREATE POLICY "Admins can manage communication settings"
ON public.communication_settings FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- RLS Policies for map settings
CREATE POLICY "Admins can manage map settings"
ON public.map_settings FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- RLS Policies for map API usage
CREATE POLICY "Admins can view map usage data"
ON public.map_api_usage FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admins can insert map usage"
ON public.map_api_usage FOR INSERT
WITH CHECK (public.is_admin());

-- RLS Policies for content management
CREATE POLICY "Admins can manage content"
ON public.content_management FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Public can view published content"
ON public.content_management FOR SELECT
USING (is_published = true);

-- RLS Policies for user permissions
CREATE POLICY "Admins can manage all permissions"
ON public.user_permissions FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Users can view their own permissions"
ON public.user_permissions FOR SELECT
USING (auth.uid() = user_id);

-- Initialize default settings
INSERT INTO public.map_settings (id, monthly_usage_limit, usage_alert_email, usage_alert_threshold)
VALUES (1, 100000, null, 80);

-- Create performance indexes
CREATE INDEX idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX idx_user_permissions_section ON public.user_permissions(menu_section);
CREATE INDEX idx_content_management_key ON public.content_management(key);
CREATE INDEX idx_content_management_published ON public.content_management(is_published);
CREATE INDEX idx_map_api_usage_time ON public.map_api_usage(log_time DESC);
CREATE INDEX idx_map_api_usage_user ON public.map_api_usage(user_id);