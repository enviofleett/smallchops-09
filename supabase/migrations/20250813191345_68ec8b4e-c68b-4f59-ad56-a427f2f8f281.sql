-- CRITICAL SECURITY FIXES - Phase 1 (Modified for existing policies)
-- Fix dangerous RLS policies and database function security

-- 1. DROP DANGEROUS RLS POLICIES ON CUSTOMER TABLES (if they exist)
DROP POLICY IF EXISTS "Allow authenticated users full access to customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated users full access to customer_accounts" ON public.customer_accounts;

-- Check if secure policies already exist and only create if missing
DO $$ 
BEGIN
    -- Create secure RLS policies for customers table if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'customers' 
        AND policyname = 'Admins can manage all customers'
    ) THEN
        CREATE POLICY "Admins can manage all customers" 
        ON public.customers 
        FOR ALL 
        USING (is_admin()) 
        WITH CHECK (is_admin());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'customers' 
        AND policyname = 'Service roles can manage customers'
    ) THEN
        CREATE POLICY "Service roles can manage customers" 
        ON public.customers 
        FOR ALL 
        USING (auth.role() = 'service_role') 
        WITH CHECK (auth.role() = 'service_role');
    END IF;

    -- Create secure RLS policies for customer_accounts table if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'customer_accounts' 
        AND policyname = 'Customers can view and update their own account'
    ) THEN
        CREATE POLICY "Customers can view and update their own account" 
        ON public.customer_accounts 
        FOR ALL 
        USING (user_id = auth.uid()) 
        WITH CHECK (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'customer_accounts' 
        AND policyname = 'Admins can manage all customer accounts'
    ) THEN
        CREATE POLICY "Admins can manage all customer accounts" 
        ON public.customer_accounts 
        FOR ALL 
        USING (is_admin()) 
        WITH CHECK (is_admin());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'customer_accounts' 
        AND policyname = 'Service roles can manage customer accounts'
    ) THEN
        CREATE POLICY "Service roles can manage customer accounts" 
        ON public.customer_accounts 
        FOR ALL 
        USING (auth.role() = 'service_role') 
        WITH CHECK (auth.role() = 'service_role');
    END IF;

    -- Secure payment_integrations table policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'payment_integrations' 
        AND policyname = 'Admins can manage payment integrations'
    ) THEN
        CREATE POLICY "Admins can manage payment integrations" 
        ON public.payment_integrations 
        FOR ALL 
        USING (is_admin()) 
        WITH CHECK (is_admin());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'payment_integrations' 
        AND policyname = 'Service roles can access payment integrations'
    ) THEN
        CREATE POLICY "Service roles can access payment integrations" 
        ON public.payment_integrations 
        FOR SELECT 
        USING (auth.role() = 'service_role');
    END IF;
END $$;

-- 2. FIX DATABASE FUNCTIONS MISSING SET search_path (CRITICAL SQL INJECTION PREVENTION)
-- Only update functions that don't already have SET search_path

CREATE OR REPLACE FUNCTION public.pg_notify(channel text, payload text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM pg_notify(channel, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_paid_at_on_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' 
     AND (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
     AND NEW.payment_status = 'paid' THEN
    NEW.paid_at := COALESCE(NEW.paid_at, now());
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_payment_polling_state_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_payment_confirmation_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.payment_status IS DISTINCT FROM NEW.payment_status
     AND NEW.payment_status = 'paid' THEN
    INSERT INTO public.communication_events (
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
      'payment_confirmation',
      NEW.customer_email,
      'payment_confirmation',
      'transactional',
      'queued',
      jsonb_build_object(
        'customerName', NEW.customer_name,
        'orderNumber', NEW.order_number,
        'amount', NEW.total_amount::text,
        'paymentMethod', COALESCE(NEW.payment_method, 'Online Payment')
      ),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.enhanced_rate_limits WHERE window_end < NOW();
END;
$function$;

-- 3. LOG SECURITY FIXES
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'critical_security_fixes_applied_phase1',
  'Security',
  'Applied critical security fixes Phase 1: Secured customer data access, hardened database functions against SQL injection',
  jsonb_build_object(
    'fixes_applied', array[
      'customer_tables_rls_secured',
      'payment_integrations_secured', 
      'database_functions_hardened',
      'sql_injection_prevention_added'
    ],
    'functions_fixed', 5,
    'security_level', 'CRITICAL',
    'phase', 1
  )
);