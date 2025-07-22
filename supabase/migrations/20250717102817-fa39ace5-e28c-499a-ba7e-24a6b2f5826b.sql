-- Add critical RLS policies for production security (corrected)

-- Enable RLS on vehicles table and add policies
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all vehicles" ON public.vehicles
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Dispatch riders can view their assigned vehicles" ON public.vehicles
FOR SELECT USING (
  id IN (
    SELECT vehicle_id FROM public.vehicle_assignments 
    WHERE dispatch_rider_id = auth.uid() AND status = 'active'
  )
);

-- Enable RLS on customers table and add policies
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all customers" ON public.customers
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Staff can view customers" ON public.customers
FOR SELECT USING (auth.role() = 'authenticated');

-- Enable RLS on promotions table and add policies (corrected)
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view promotions" ON public.promotions
FOR SELECT USING (true);

CREATE POLICY "Admins can manage all promotions" ON public.promotions
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Enable RLS on points_transactions table and add policies
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all points transactions" ON public.points_transactions
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Customers can view their own points transactions" ON public.points_transactions
FOR SELECT USING (customer_id = auth.uid());

-- Enable RLS on notifications table and add policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all notifications" ON public.notifications
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Enable RLS on positions table and add policies
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all positions" ON public.positions
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Enable RLS on guarantors table and add policies
ALTER TABLE public.guarantors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all guarantors" ON public.guarantors
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Enable RLS on guarantor_requirements table and add policies
ALTER TABLE public.guarantor_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all guarantor requirements" ON public.guarantor_requirements
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Enable RLS on guarantor_documents table and add policies
ALTER TABLE public.guarantor_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all guarantor documents" ON public.guarantor_documents
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Enable RLS on nin_verifications table and add policies
ALTER TABLE public.nin_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all NIN verifications" ON public.nin_verifications
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Enable RLS on subscriber_registrations table and add policies
ALTER TABLE public.subscriber_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all subscriber registrations" ON public.subscriber_registrations
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Enable RLS on subscribers table and add policies
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all subscribers" ON public.subscribers
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Enable RLS on content_versions table and add policies
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all content versions" ON public.content_versions
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Enable RLS on payment_integrations table and add policies
ALTER TABLE public.payment_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payment integrations" ON public.payment_integrations
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Enable RLS on api_calls_monitor table and add policies
ALTER TABLE public.api_calls_monitor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view API monitoring data" ON public.api_calls_monitor
FOR SELECT USING (public.is_admin());

CREATE POLICY "System can insert API monitoring data" ON public.api_calls_monitor
FOR INSERT WITH CHECK (true);

-- Enable RLS on app_logs table and add policies
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view app logs" ON public.app_logs
FOR SELECT USING (public.is_admin());

CREATE POLICY "System can insert app logs" ON public.app_logs
FOR INSERT WITH CHECK (true);

-- Enable RLS on alerts table and add policies
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all alerts" ON public.alerts
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Enable RLS on alert_configs table and add policies
ALTER TABLE public.alert_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage alert configs" ON public.alert_configs
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Enable RLS on processed_geofence_alerts table and add policies
ALTER TABLE public.processed_geofence_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage processed geofence alerts" ON public.processed_geofence_alerts
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());