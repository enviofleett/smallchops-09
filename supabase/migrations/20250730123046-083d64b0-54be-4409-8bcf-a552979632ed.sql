-- Fix security warnings by setting search_path for functions

-- Fix function 1: create_logo_version
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix function 2: check_upload_rate_limit
CREATE OR REPLACE FUNCTION public.check_upload_rate_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
  v_max_uploads INTEGER := 10; -- Max 10 uploads per hour
  v_current_hour TIMESTAMPTZ := date_trunc('hour', NOW());
BEGIN
  SELECT upload_count INTO v_count
  FROM public.upload_rate_limits
  WHERE user_id = p_user_id
  AND window_hour = v_current_hour;
  
  IF v_count IS NULL THEN
    INSERT INTO public.upload_rate_limits (user_id, upload_count, window_hour)
    VALUES (p_user_id, 1, v_current_hour)
    ON CONFLICT (user_id, window_hour) 
    DO UPDATE SET upload_count = upload_rate_limits.upload_count + 1;
    RETURN TRUE;
  ELSIF v_count < v_max_uploads THEN
    UPDATE public.upload_rate_limits
    SET upload_count = upload_count + 1
    WHERE user_id = p_user_id
    AND window_hour = v_current_hour;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix function 3: log_branding_change
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix function 4: calculate_brand_consistency_score
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
  IF v_settings.website_url IS NULL THEN v_score := v_score - 5; END IF;
  IF v_settings.logo_alt_text IS NULL THEN v_score := v_score - 5; END IF;
  IF v_settings.seo_title IS NULL THEN v_score := v_score - 5; END IF;
  IF v_settings.seo_description IS NULL THEN v_score := v_score - 5; END IF;
  
  RETURN GREATEST(v_score, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;