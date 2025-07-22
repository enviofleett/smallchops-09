-- Fix the last remaining function search path issue

-- Fix set_current_timestamp_updated_at function
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Phase 4: Storage Buckets and Final Production Setup

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for category banners  
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-banners', 'category-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for business logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-logos', 'business-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for product images
CREATE POLICY "Public read access for product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- Set up storage policies for category banners
CREATE POLICY "Public read access for category banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'category-banners');

CREATE POLICY "Authenticated users can upload category banners"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'category-banners' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update category banners"
ON storage.objects FOR UPDATE
USING (bucket_id = 'category-banners' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete category banners"
ON storage.objects FOR DELETE
USING (bucket_id = 'category-banners' AND auth.role() = 'authenticated');

-- Set up storage policies for business logos
CREATE POLICY "Public read access for business logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'business-logos');

CREATE POLICY "Admins can upload business logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'business-logos' AND public.is_admin());

CREATE POLICY "Admins can update business logos"
ON storage.objects FOR UPDATE  
USING (bucket_id = 'business-logos' AND public.is_admin());

CREATE POLICY "Admins can delete business logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'business-logos' AND public.is_admin());

-- Public access policies for public-facing features
CREATE POLICY "Public can view active products"
ON public.products FOR SELECT
USING (status = 'active');

CREATE POLICY "Public can view categories"
ON public.categories FOR SELECT
USING (true);

-- Create audit log triggers for critical operations
CREATE OR REPLACE FUNCTION public.log_settings_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  actor_id UUID;
  new_jsonb JSONB;
  old_jsonb JSONB;
BEGIN
  -- Convert row records to jsonb
  IF TG_OP != 'DELETE' THEN
    new_jsonb := to_jsonb(NEW);
  END IF;
  IF TG_OP != 'INSERT' THEN
    old_jsonb := to_jsonb(OLD);
  END IF;

  -- Try to get the user ID from connected_by column if it exists
  IF TG_OP = 'DELETE' THEN
    IF old_jsonb ? 'connected_by' THEN
      actor_id := (old_jsonb ->> 'connected_by')::uuid;
    END IF;
  ELSE
    IF new_jsonb ? 'connected_by' THEN
      actor_id := (new_jsonb ->> 'connected_by')::uuid;
    END IF;
  END IF;

  -- Fallback to auth.uid()
  IF actor_id IS NULL THEN
    actor_id := auth.uid();
  END IF;
  
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
    actor_id,
    TG_OP,
    'Settings',
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CONCAT(TG_TABLE_NAME, ' ', TG_OP, ' by user ', COALESCE(actor_id::text, 'system')),
    CASE WHEN TG_OP = 'DELETE' THEN old_jsonb ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN new_jsonb ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add audit triggers to settings tables
CREATE TRIGGER audit_business_settings
AFTER INSERT OR UPDATE OR DELETE ON public.business_settings
FOR EACH ROW EXECUTE FUNCTION public.log_settings_changes();

CREATE TRIGGER audit_payment_integrations
AFTER INSERT OR UPDATE OR DELETE ON public.payment_integrations
FOR EACH ROW EXECUTE FUNCTION public.log_settings_changes();

CREATE TRIGGER audit_communication_settings
AFTER INSERT OR UPDATE OR DELETE ON public.communication_settings  
FOR EACH ROW EXECUTE FUNCTION public.log_settings_changes();