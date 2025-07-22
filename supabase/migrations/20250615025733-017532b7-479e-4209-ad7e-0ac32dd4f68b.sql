
-- 1. Business Settings table
CREATE TABLE public.business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  address text,
  phone text,
  working_hours text,
  logo_url text,
  registration_number text,
  tax_id text,
  licenses text,
  social_links jsonb,
  business_hours jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. User Permissions
CREATE TYPE public.menu_section AS ENUM (
  'dashboard','orders','products','customers','delivery','reports','settings','promotions','audit_logs'
);

CREATE TYPE public.permission_level AS ENUM (
  'view','create','edit','delete','export'
);

CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- references public.profiles.id (not FK constraint to avoid auth schema)
  menu_section menu_section NOT NULL,
  permission_level permission_level NOT NULL,
  UNIQUE (user_id, menu_section, permission_level)
);

-- 3. Payment Integrations (Paystack)
CREATE TABLE public.payment_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL, -- e.g. 'paystack'
  public_key text,
  secret_key text,
  mode text, -- 'test' or 'live'
  webhook_url text,
  currency text DEFAULT 'NGN',
  transaction_fee numeric,
  payment_methods jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  connected_by uuid, -- references admin (optional)
  connection_status text
);

-- 4. Communication Settings (SMS/Email)
CREATE TABLE public.communication_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sms_provider text,
  sms_api_key text,
  sms_sender_id text,
  sms_templates jsonb,
  email_provider text,
  email_api_key text,
  smtp_host text,
  smtp_port integer,
  smtp_user text,
  smtp_pass text,
  email_templates jsonb,
  sender_email text,
  enable_sms boolean DEFAULT false,
  enable_email boolean DEFAULT false,
  triggers jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  connected_by uuid -- references admin (optional)
);

-- 5. Shipping Integrations (Envio API)
CREATE TABLE public.shipping_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text, -- 'envio'
  token text, -- The Envio API connection token
  settings jsonb,
  status text,
  zones jsonb,
  delivery_time text,
  shipping_rates jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  connected_by uuid -- references admin (optional)
);

-- 6. Row Level Security (RLS) to restrict all settings tables to admins
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_integrations ENABLE ROW LEVEL SECURITY;

-- Function to check if the user is an admin (reuse if already present)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid();
$$;

-- Policies to allow only admins to SELECT/INSERT/UPDATE/DELETE
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'business_settings', 'user_permissions', 'payment_integrations', 'communication_settings', 'shipping_integrations'
  ]
  LOOP
    EXECUTE format('CREATE POLICY "Admins can manage %I" ON public.%I USING (public.is_admin());', t, t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

