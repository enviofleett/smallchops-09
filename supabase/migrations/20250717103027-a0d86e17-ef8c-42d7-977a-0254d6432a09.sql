-- Enable RLS on remaining tables (skip those that already have policies)

-- Check and enable RLS only on tables that need it
DO $$
BEGIN
    -- Enable RLS on vehicles if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicles' AND policyname = 'Admins can manage all vehicles') THEN
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
    END IF;

    -- Enable RLS on customers if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'Admins can manage all customers') THEN
        ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage all customers" ON public.customers
        FOR ALL USING (public.is_admin())
        WITH CHECK (public.is_admin());

        CREATE POLICY "Staff can view customers" ON public.customers
        FOR SELECT USING (auth.role() = 'authenticated');
    END IF;

    -- Enable RLS on promotions if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'promotions' AND policyname = 'Admins can manage all promotions') THEN
        ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Everyone can view promotions" ON public.promotions
        FOR SELECT USING (true);

        CREATE POLICY "Admins can manage all promotions" ON public.promotions
        FOR ALL USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;

    -- Enable RLS on points_transactions if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'points_transactions' AND policyname = 'Admins can manage all points transactions') THEN
        ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage all points transactions" ON public.points_transactions
        FOR ALL USING (public.is_admin())
        WITH CHECK (public.is_admin());

        CREATE POLICY "Customers can view their own points transactions" ON public.points_transactions
        FOR SELECT USING (customer_id = auth.uid());
    END IF;

    -- Enable RLS on positions if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'positions' AND policyname = 'Admins can manage all positions') THEN
        ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage all positions" ON public.positions
        FOR ALL USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;

    -- Enable RLS on guarantors if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guarantors' AND policyname = 'Admins can manage all guarantors') THEN
        ALTER TABLE public.guarantors ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage all guarantors" ON public.guarantors
        FOR ALL USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;

    -- Enable RLS on guarantor_requirements if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guarantor_requirements' AND policyname = 'Admins can manage all guarantor requirements') THEN
        ALTER TABLE public.guarantor_requirements ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage all guarantor requirements" ON public.guarantor_requirements
        FOR ALL USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;

    -- Enable RLS on guarantor_documents if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guarantor_documents' AND policyname = 'Admins can manage all guarantor documents') THEN
        ALTER TABLE public.guarantor_documents ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage all guarantor documents" ON public.guarantor_documents
        FOR ALL USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;

    -- Enable RLS on nin_verifications if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nin_verifications' AND policyname = 'Admins can manage all NIN verifications') THEN
        ALTER TABLE public.nin_verifications ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage all NIN verifications" ON public.nin_verifications
        FOR ALL USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;

    -- Enable RLS on subscriber_registrations if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriber_registrations' AND policyname = 'Admins can manage all subscriber registrations') THEN
        ALTER TABLE public.subscriber_registrations ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage all subscriber registrations" ON public.subscriber_registrations
        FOR ALL USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;

    -- Enable RLS on subscribers if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscribers' AND policyname = 'Admins can manage all subscribers') THEN
        ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage all subscribers" ON public.subscribers
        FOR ALL USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;

    -- Enable RLS on content_versions if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'content_versions' AND policyname = 'Admins can manage all content versions') THEN
        ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage all content versions" ON public.content_versions
        FOR ALL USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;

    -- Enable RLS on api_calls_monitor if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'api_calls_monitor' AND policyname = 'Admins can view API monitoring data') THEN
        ALTER TABLE public.api_calls_monitor ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can view API monitoring data" ON public.api_calls_monitor
        FOR SELECT USING (public.is_admin());

        CREATE POLICY "System can insert API monitoring data" ON public.api_calls_monitor
        FOR INSERT WITH CHECK (true);
    END IF;

    -- Enable RLS on app_logs if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_logs' AND policyname = 'Admins can view app logs') THEN
        ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can view app logs" ON public.app_logs
        FOR SELECT USING (public.is_admin());

        CREATE POLICY "System can insert app logs" ON public.app_logs
        FOR INSERT WITH CHECK (true);
    END IF;

    -- Enable RLS on alerts if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alerts' AND policyname = 'Admins can manage all alerts') THEN
        ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage all alerts" ON public.alerts
        FOR ALL USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;

    -- Enable RLS on alert_configs if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alert_configs' AND policyname = 'Admins can manage alert configs') THEN
        ALTER TABLE public.alert_configs ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage alert configs" ON public.alert_configs
        FOR ALL USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;

    -- Enable RLS on processed_geofence_alerts if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'processed_geofence_alerts' AND policyname = 'Admins can manage processed geofence alerts') THEN
        ALTER TABLE public.processed_geofence_alerts ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Admins can manage processed geofence alerts" ON public.processed_geofence_alerts
        FOR ALL USING (public.is_admin())
        WITH CHECK (public.is_admin());
    END IF;

END $$;