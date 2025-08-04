-- Phase 1B: Add Missing RLS Policies for 4 tables (Fixed)
-- Fix tables that have RLS enabled but no policies

-- Add RLS policies for product_price_history table
CREATE POLICY "Admins can view price history" ON product_price_history
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "Service roles can manage price history" ON product_price_history
  FOR ALL TO service_role
  USING (true);

-- Add RLS policies for promotion_usage table  
CREATE POLICY "Admins can view promotion usage" ON promotion_usage
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "Service roles can manage promotion usage" ON promotion_usage
  FOR ALL TO service_role
  USING (true);

-- Add RLS policies for promotions table (using correct column name)
CREATE POLICY "Admins can manage promotions" ON promotions
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Public can view active promotions" ON promotions
  FOR SELECT TO anon, authenticated
  USING (status = 'active' AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until > NOW()));

-- Add RLS policies for vehicles table (using correct column name)
CREATE POLICY "Admins can manage vehicles" ON vehicles
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Service roles can manage vehicles" ON vehicles
  FOR ALL TO service_role
  USING (true);

-- Fix more database functions with missing search_path
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
  SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.trigger_enhanced_email_processing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
DECLARE
  config_record RECORD;
BEGIN
  -- Get enhanced email configuration
  SELECT * INTO config_record FROM public.enhanced_email_config LIMIT 1;
  
  -- Only trigger for queued events if enhanced processing is enabled
  IF NEW.status = 'queued' AND COALESCE(config_record.instant_processing_enabled, true) THEN
    -- Add to processing queue with appropriate priority
    INSERT INTO public.email_processing_queue (
      event_id,
      priority,
      scheduled_for,
      max_attempts
    ) VALUES (
      NEW.id,
      CASE 
        WHEN NEW.priority = 'high' OR NEW.event_type = 'customer_welcome' THEN 'high'
        WHEN NEW.priority = 'low' THEN 'low'
        ELSE 'normal'
      END,
      NOW(),
      COALESCE(config_record.max_retries, 3)
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.requeue_failed_welcome_emails()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_requeued_count INTEGER := 0;
BEGIN
  -- Requeue failed customer welcome emails from the last 24 hours
  UPDATE communication_events 
  SET 
    status = 'queued'::communication_event_status,
    retry_count = 0,
    last_error = NULL,
    error_message = NULL,
    updated_at = NOW()
  WHERE event_type = 'customer_welcome'
  AND status = 'failed'::communication_event_status
  AND created_at >= NOW() - INTERVAL '24 hours'
  AND (error_message ILIKE '%suspended%' OR error_message ILIKE '%SMTP%' OR last_error ILIKE '%550%');
  
  GET DIAGNOSTICS v_requeued_count = ROW_COUNT;
  
  -- Log the requeue operation
  INSERT INTO audit_logs (
    action,
    category,
    message,
    new_values
  ) VALUES (
    'requeue_failed_emails',
    'Email Processing',
    'Requeued ' || v_requeued_count || ' failed welcome emails after SMTP fix',
    jsonb_build_object('requeued_count', v_requeued_count)
  );
  
  RETURN v_requeued_count;
END;
$function$;