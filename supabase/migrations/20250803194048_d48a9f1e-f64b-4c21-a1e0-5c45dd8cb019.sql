-- Fix database security issues and implement admin-only audit log filtering

-- First, fix function search path issues for security
CREATE OR REPLACE FUNCTION public.is_email_suppressed(email_address text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.email_suppression_list 
    WHERE email_address = $1
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_email_consent(email_address text, consent_type text DEFAULT 'marketing'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.email_consents 
    WHERE email_address = $1 
    AND consent_type = $2 
    AND is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_send_email_to(email_address text, email_type text DEFAULT 'transactional'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.email_unsubscribes 
    WHERE email_unsubscribes.email_address = can_send_email_to.email_address
    AND (
      unsubscribe_type = 'all' 
      OR (email_type = 'marketing' AND unsubscribe_type = 'marketing')
    )
  );
$function$;

-- Add RLS policies for tables that need them
CREATE POLICY "Service roles can manage driver analytics" ON public.driver_analytics 
FOR ALL USING (auth.role() = 'service_role') 
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view driver analytics" ON public.driver_analytics 
FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can manage email bounce tracking" ON public.email_bounce_tracking 
FOR ALL USING (auth.role() = 'service_role') 
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view email bounce tracking" ON public.email_bounce_tracking 
FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can manage email delivery logs" ON public.email_delivery_logs 
FOR ALL USING (auth.role() = 'service_role') 
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view email delivery logs" ON public.email_delivery_logs 
FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can manage email processing queue" ON public.email_processing_queue 
FOR ALL USING (auth.role() = 'service_role') 
WITH CHECK (auth.role() = 'service_role');

-- Create a helper function to check if user is admin or specific email
CREATE OR REPLACE FUNCTION public.is_admin_or_specific_email(specific_email text DEFAULT 'chudesyl@gmail.com')
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')) OR
    (EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = specific_email));
$function$;