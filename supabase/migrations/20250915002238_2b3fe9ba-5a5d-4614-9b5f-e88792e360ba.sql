-- PHASE 1: Additional RLS Policies for Payment Security

-- Enable RLS and create policies for payment_integrations
ALTER TABLE public.payment_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "only_admins_can_access_payment_integrations" ON public.payment_integrations
    FOR ALL 
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "service_role_can_access_payment_integrations" ON public.payment_integrations
    FOR ALL 
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Enable RLS and create policies for payment_processing_status
ALTER TABLE public.payment_processing_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_view_payment_processing_status" ON public.payment_processing_status
    FOR SELECT 
    USING (is_admin());

CREATE POLICY "service_role_can_manage_payment_processing_status" ON public.payment_processing_status
    FOR ALL 
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Enable RLS and create policies for payment_transactions
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_can_view_own_payment_transactions" ON public.payment_transactions
    FOR SELECT 
    USING (auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM orders o 
        WHERE o.id = payment_transactions.order_id 
        AND (o.customer_id IN (
            SELECT id FROM customer_accounts WHERE user_id = auth.uid()
        ) OR lower(o.customer_email) = lower(current_user_email()))
    ));

CREATE POLICY "admins_can_manage_payment_transactions" ON public.payment_transactions
    FOR ALL 
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY "service_role_can_manage_payment_transactions" ON public.payment_transactions
    FOR ALL 
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Create production readiness checker function with enhanced checks
CREATE OR REPLACE FUNCTION public.check_production_readiness()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_issues text[] := array[]::text[];
  v_warnings text[] := array[]::text[];
  v_score integer := 100;
  v_email_count integer;
  v_payment_success_rate numeric;
  v_business_config_exists boolean;
BEGIN
  -- Check business configuration
  SELECT EXISTS(SELECT 1 FROM business_settings WHERE name IS NOT NULL AND name != '') 
  INTO v_business_config_exists;
  
  IF NOT v_business_config_exists THEN
    v_issues := array_append(v_issues, 'Business settings not configured - missing company name');
    v_score := v_score - 20;
  END IF;
  
  -- Check stuck email queue
  SELECT COUNT(*) INTO v_email_count
  FROM communication_events 
  WHERE status = 'queued' AND created_at < NOW() - INTERVAL '1 hour';
  
  IF v_email_count > 0 THEN
    v_issues := array_append(v_issues, format('Email system has %s stuck emails in queue', v_email_count));
    v_score := v_score - 15;
  END IF;
  
  -- Check payment success rate (last 100 orders)
  SELECT COALESCE(
    (COUNT(CASE WHEN payment_status = 'paid' THEN 1 END)::numeric / 
     NULLIF(COUNT(*), 0)) * 100, 0
  ) INTO v_payment_success_rate
  FROM orders 
  WHERE created_at > NOW() - INTERVAL '30 days'
  ORDER BY created_at DESC 
  LIMIT 100;
  
  IF v_payment_success_rate < 85 THEN
    v_issues := array_append(v_issues, format('Payment success rate is %.1f%% (target: >85%%)', v_payment_success_rate));
    v_score := v_score - 25;
  ELSIF v_payment_success_rate < 95 THEN
    v_warnings := array_append(v_warnings, format('Payment success rate is %.1f%% (good: >95%%)', v_payment_success_rate));
    v_score := v_score - 5;
  END IF;
  
  -- Check for failed communication events
  IF EXISTS(SELECT 1 FROM communication_events WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours') THEN
    v_warnings := array_append(v_warnings, 'Recent failed email events detected in last 24 hours');
    v_score := v_score - 5;
  END IF;
  
  RETURN jsonb_build_object(
    'ready_for_production', (array_length(v_issues, 1) IS NULL AND v_score >= 85),
    'score', v_score,
    'issues', v_issues,
    'warnings', v_warnings,
    'checked_at', NOW(),
    'email_queue_health', jsonb_build_object(
      'stuck_emails', v_email_count,
      'payment_success_rate', v_payment_success_rate
    )
  );
END;
$function$;