-- Enhanced branding system database setup

-- Enhance business_settings table with additional branding fields
ALTER TABLE public.business_settings 
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#3b82f6',
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#1e40af',
ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#f59e0b',
ADD COLUMN IF NOT EXISTS logo_alt_text TEXT,
ADD COLUMN IF NOT EXISTS logo_dark_url TEXT,
ADD COLUMN IF NOT EXISTS favicon_url TEXT,
ADD COLUMN IF NOT EXISTS social_card_url TEXT,
ADD COLUMN IF NOT EXISTS brand_guidelines TEXT,
ADD COLUMN IF NOT EXISTS logo_usage_rules TEXT;

-- Create branding_audit_log table for detailed brand change tracking
CREATE TABLE IF NOT EXISTS public.branding_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on branding_audit_log
ALTER TABLE public.branding_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for branding_audit_log
CREATE POLICY "Admins can view all branding audit logs" ON public.branding_audit_log
FOR SELECT TO authenticated
USING (is_admin());

CREATE POLICY "System can insert branding audit logs" ON public.branding_audit_log
FOR INSERT TO authenticated
WITH CHECK (true);

-- Create logo_versions table for logo version management
CREATE TABLE IF NOT EXISTS public.logo_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  logo_url TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  dimensions JSONB, -- {width: 200, height: 60}
  uploaded_by UUID REFERENCES auth.users(id),
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  is_current BOOLEAN DEFAULT FALSE,
  replaced_at TIMESTAMPTZ,
  replaced_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on logo_versions
ALTER TABLE public.logo_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies for logo_versions
CREATE POLICY "Admins can manage logo versions" ON public.logo_versions
FOR ALL TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Create brand_assets table for multiple brand assets
CREATE TABLE IF NOT EXISTS public.brand_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_type TEXT NOT NULL, -- 'logo_primary', 'logo_secondary', 'favicon', etc.
  asset_url TEXT NOT NULL,
  asset_name TEXT,
  file_size BIGINT,
  file_type TEXT,
  dimensions JSONB,
  uploaded_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on brand_assets
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies for brand_assets
CREATE POLICY "Admins can manage brand assets" ON public.brand_assets
FOR ALL TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Create upload_rate_limits table for security
CREATE TABLE IF NOT EXISTS public.upload_rate_limits (
  user_id UUID REFERENCES auth.users(id),
  upload_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, date_trunc('hour', window_start))
);

-- Enable RLS on upload_rate_limits
ALTER TABLE public.upload_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for upload_rate_limits
CREATE POLICY "Users can view their own rate limits" ON public.upload_rate_limits
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System can manage rate limits" ON public.upload_rate_limits
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Function to create new logo version
CREATE OR REPLACE FUNCTION public.create_logo_version(
  p_logo_url TEXT,
  p_file_size BIGINT,
  p_file_type TEXT,
  p_dimensions JSONB,
  p_uploaded_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_version_number INTEGER;
  v_version_id UUID;
BEGIN
  -- Mark previous version as not current
  UPDATE public.logo_versions 
  SET is_current = FALSE, 
      replaced_at = NOW(),
      replaced_by = p_uploaded_by
  WHERE is_current = TRUE;
  
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 
  INTO v_version_number 
  FROM public.logo_versions;
  
  -- Insert new version
  INSERT INTO public.logo_versions (
    logo_url, version_number, file_size, file_type, 
    dimensions, uploaded_by, is_current
  ) VALUES (
    p_logo_url, v_version_number, p_file_size, p_file_type,
    p_dimensions, p_uploaded_by, TRUE
  ) RETURNING id INTO v_version_id;
  
  RETURN v_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check upload rate limit
CREATE OR REPLACE FUNCTION public.check_upload_rate_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
  v_max_uploads INTEGER := 10; -- Max 10 uploads per hour
BEGIN
  SELECT upload_count INTO v_count
  FROM public.upload_rate_limits
  WHERE user_id = p_user_id
  AND window_start = date_trunc('hour', NOW());
  
  IF v_count IS NULL THEN
    INSERT INTO public.upload_rate_limits (user_id, upload_count)
    VALUES (p_user_id, 1);
    RETURN TRUE;
  ELSIF v_count < v_max_uploads THEN
    UPDATE public.upload_rate_limits
    SET upload_count = upload_count + 1
    WHERE user_id = p_user_id
    AND window_start = date_trunc('hour', NOW());
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log branding changes
CREATE OR REPLACE FUNCTION public.log_branding_change(
  p_action TEXT,
  p_field_name TEXT,
  p_old_value TEXT,
  p_new_value TEXT,
  p_metadata JSONB DEFAULT '{}',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.branding_audit_log (
    user_id, action, field_name, old_value, new_value, 
    metadata, ip_address, user_agent
  ) VALUES (
    auth.uid(), p_action, p_field_name, p_old_value, p_new_value,
    p_metadata, p_ip_address, p_user_agent
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get brand consistency score
CREATE OR REPLACE FUNCTION public.calculate_brand_consistency_score()
RETURNS NUMERIC AS $$
DECLARE
  v_score NUMERIC := 100;
  v_settings RECORD;
BEGIN
  SELECT * INTO v_settings FROM public.business_settings ORDER BY updated_at DESC LIMIT 1;
  
  -- Deduct points for missing elements
  IF v_settings.logo_url IS NULL THEN v_score := v_score - 20; END IF;
  IF v_settings.name IS NULL OR LENGTH(v_settings.name) = 0 THEN v_score := v_score - 15; END IF;
  IF v_settings.primary_color = '#3b82f6' THEN v_score := v_score - 10; END IF; -- Default color
  IF v_settings.secondary_color = '#1e40af' THEN v_score := v_score - 10; END IF; -- Default color
  IF v_settings.tagline IS NULL THEN v_score := v_score - 5; END IF;
  IF v_settings.website_url IS NULL THEN v_score := v_score - 10; END IF;
  IF v_settings.logo_alt_text IS NULL THEN v_score := v_score - 5; END IF;
  IF v_settings.seo_title IS NULL THEN v_score := v_score - 5; END IF;
  IF v_settings.seo_description IS NULL THEN v_score := v_score - 5; END IF;
  
  RETURN GREATEST(v_score, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_branding_audit_log_user_id ON public.branding_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_branding_audit_log_changed_at ON public.branding_audit_log(changed_at);
CREATE INDEX IF NOT EXISTS idx_branding_audit_log_field_name ON public.branding_audit_log(field_name);
CREATE INDEX IF NOT EXISTS idx_logo_versions_current ON public.logo_versions(is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_brand_assets_type ON public.brand_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_brand_assets_active ON public.brand_assets(is_active) WHERE is_active = TRUE;