
-- Fix RLS policies for all settings tables to ensure proper admin access

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Admins can manage business_settings" ON public.business_settings;
DROP POLICY IF EXISTS "Admins can manage user_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins can manage payment_integrations" ON public.payment_integrations;
DROP POLICY IF EXISTS "Admins can manage communication_settings" ON public.communication_settings;
DROP POLICY IF EXISTS "Admins can manage shipping_integrations" ON public.shipping_integrations;

-- Create comprehensive policies for business_settings
CREATE POLICY "Admins can select business_settings" ON public.business_settings FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert business_settings" ON public.business_settings FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update business_settings" ON public.business_settings FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete business_settings" ON public.business_settings FOR DELETE USING (public.is_admin());

-- Create comprehensive policies for user_permissions
CREATE POLICY "Admins can select user_permissions" ON public.user_permissions FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert user_permissions" ON public.user_permissions FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update user_permissions" ON public.user_permissions FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete user_permissions" ON public.user_permissions FOR DELETE USING (public.is_admin());

-- Create comprehensive policies for payment_integrations
CREATE POLICY "Admins can select payment_integrations" ON public.payment_integrations FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert payment_integrations" ON public.payment_integrations FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update payment_integrations" ON public.payment_integrations FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete payment_integrations" ON public.payment_integrations FOR DELETE USING (public.is_admin());

-- Create comprehensive policies for communication_settings
CREATE POLICY "Admins can select communication_settings" ON public.communication_settings FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert communication_settings" ON public.communication_settings FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update communication_settings" ON public.communication_settings FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete communication_settings" ON public.communication_settings FOR DELETE USING (public.is_admin());

-- Create comprehensive policies for shipping_integrations
CREATE POLICY "Admins can select shipping_integrations" ON public.shipping_integrations FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert shipping_integrations" ON public.shipping_integrations FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update shipping_integrations" ON public.shipping_integrations FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete shipping_integrations" ON public.shipping_integrations FOR DELETE USING (public.is_admin());

-- Add audit logging triggers for settings changes
CREATE OR REPLACE FUNCTION public.log_settings_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    category,
    entity_type,
    entity_id,
    message,
    old_values,
    new_values
  ) VALUES (
    auth.uid(),
    TG_OP,
    'Settings',
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CONCAT(TG_TABLE_NAME, ' ', TG_OP, ' by user ', COALESCE(auth.uid()::text, 'system')),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add triggers for all settings tables
DROP TRIGGER IF EXISTS business_settings_audit ON public.business_settings;
CREATE TRIGGER business_settings_audit
AFTER INSERT OR UPDATE OR DELETE ON public.business_settings
FOR EACH ROW EXECUTE FUNCTION public.log_settings_changes();

DROP TRIGGER IF EXISTS payment_integrations_audit ON public.payment_integrations;
CREATE TRIGGER payment_integrations_audit
AFTER INSERT OR UPDATE OR DELETE ON public.payment_integrations
FOR EACH ROW EXECUTE FUNCTION public.log_settings_changes();

DROP TRIGGER IF EXISTS communication_settings_audit ON public.communication_settings;
CREATE TRIGGER communication_settings_audit
AFTER INSERT OR UPDATE OR DELETE ON public.communication_settings
FOR EACH ROW EXECUTE FUNCTION public.log_settings_changes();

DROP TRIGGER IF EXISTS shipping_integrations_audit ON public.shipping_integrations;
CREATE TRIGGER shipping_integrations_audit
AFTER INSERT OR UPDATE OR DELETE ON public.shipping_integrations
FOR EACH ROW EXECUTE FUNCTION public.log_settings_changes();
