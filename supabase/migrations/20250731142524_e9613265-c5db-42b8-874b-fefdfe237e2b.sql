-- Phase 2: Enhanced Security & Performance Tables
CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  request_payload JSONB,
  response_status INTEGER,
  response_time_ms INTEGER,
  customer_id UUID,
  session_id TEXT,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  ip_address INET,
  user_agent TEXT,
  endpoint TEXT,
  details JSONB,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID,
  ip_address INET,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tier TEXT NOT NULL DEFAULT 'standard',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Phase 3: Customer Experience Tables
CREATE TABLE IF NOT EXISTS public.order_modifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  modification_type TEXT NOT NULL,
  original_data JSONB,
  new_data JSONB,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  status TEXT NOT NULL,
  location JSONB,
  estimated_arrival TIMESTAMP WITH TIME ZONE,
  actual_arrival TIMESTAMP WITH TIME ZONE,
  driver_info JSONB,
  tracking_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_notification_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  channel_type TEXT NOT NULL,
  channel_value TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Phase 5: Monitoring & Analytics Tables
CREATE TABLE IF NOT EXISTS public.api_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  dimensions JSONB,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  dimensions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Security & Performance tables
CREATE POLICY "Admins can view all request logs" ON public.api_request_logs FOR SELECT USING (is_admin());
CREATE POLICY "Service roles can insert request logs" ON public.api_request_logs FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can manage security incidents" ON public.security_incidents FOR ALL USING (is_admin());
CREATE POLICY "Service roles can insert security incidents" ON public.security_incidents FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service roles can manage rate limits" ON public.customer_rate_limits FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for Customer Experience tables
CREATE POLICY "Customers can view their order modifications" ON public.order_modifications FOR SELECT 
  USING (order_id IN (SELECT id FROM orders WHERE customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())));
CREATE POLICY "Staff can manage order modifications" ON public.order_modifications FOR ALL 
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text]));

CREATE POLICY "Customers can view their delivery tracking" ON public.delivery_tracking FOR SELECT 
  USING (order_id IN (SELECT id FROM orders WHERE customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())));
CREATE POLICY "Staff can manage delivery tracking" ON public.delivery_tracking FOR ALL 
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text]));

CREATE POLICY "Customers can manage their notification channels" ON public.customer_notification_channels FOR ALL 
  USING (customer_id IN (SELECT id FROM customer_accounts WHERE user_id = auth.uid()));

-- RLS Policies for Analytics tables
CREATE POLICY "Admins can view all metrics" ON public.api_metrics FOR SELECT USING (is_admin());
CREATE POLICY "Service roles can insert metrics" ON public.api_metrics FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view business analytics" ON public.business_analytics FOR SELECT USING (is_admin());
CREATE POLICY "Service roles can insert analytics" ON public.business_analytics FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX idx_api_request_logs_created_at ON public.api_request_logs(created_at);
CREATE INDEX idx_api_request_logs_endpoint ON public.api_request_logs(endpoint);
CREATE INDEX idx_customer_rate_limits_customer_endpoint ON public.customer_rate_limits(customer_id, endpoint);
CREATE INDEX idx_delivery_tracking_order_id ON public.delivery_tracking(order_id);
CREATE INDEX idx_api_metrics_endpoint_timestamp ON public.api_metrics(endpoint, timestamp);

-- Functions for enhanced functionality
CREATE OR REPLACE FUNCTION public.log_api_request(
  p_endpoint TEXT,
  p_method TEXT,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_payload JSONB DEFAULT NULL,
  p_response_status INTEGER DEFAULT NULL,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_error_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.api_request_logs (
    endpoint, method, ip_address, user_agent, request_payload,
    response_status, response_time_ms, customer_id, session_id, error_details
  ) VALUES (
    p_endpoint, p_method, p_ip_address, p_user_agent, p_request_payload,
    p_response_status, p_response_time_ms, p_customer_id, p_session_id, p_error_details
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_customer_rate_limit(
  p_customer_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_endpoint TEXT DEFAULT 'general',
  p_tier TEXT DEFAULT 'standard'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
  v_limit INTEGER;
  v_window_minutes INTEGER := 60;
BEGIN
  -- Set limits based on tier
  CASE p_tier
    WHEN 'premium' THEN v_limit := 1000;
    WHEN 'business' THEN v_limit := 500;
    ELSE v_limit := 100; -- standard
  END CASE;
  
  -- Count requests in the last hour
  SELECT COUNT(*) INTO v_count
  FROM public.customer_rate_limits
  WHERE (p_customer_id IS NULL OR customer_id = p_customer_id)
    AND (p_ip_address IS NULL OR ip_address = p_ip_address)
    AND endpoint = p_endpoint
    AND window_start > now() - interval '1 hour';
    
  IF v_count >= v_limit THEN
    RETURN false;
  END IF;
  
  -- Log this request
  INSERT INTO public.customer_rate_limits (customer_id, ip_address, endpoint, tier)
  VALUES (p_customer_id, p_ip_address, p_endpoint, p_tier);
  
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_security_incident(
  p_incident_type TEXT,
  p_severity TEXT DEFAULT 'medium',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_endpoint TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_incident_id UUID;
BEGIN
  INSERT INTO public.security_incidents (
    incident_type, severity, ip_address, user_agent, endpoint, details
  ) VALUES (
    p_incident_type, p_severity, p_ip_address, p_user_agent, p_endpoint, p_details
  ) RETURNING id INTO v_incident_id;
  
  RETURN v_incident_id;
END;
$function$;