-- Phase 1C: Fix remaining database functions with missing search_path
-- Complete the security fixes for all remaining functions

CREATE OR REPLACE FUNCTION public.calculate_brand_consistency_score()
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
BEGIN
  DELETE FROM public.enhanced_rate_limits WHERE window_end < NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_logo_version(p_logo_url text, p_file_size bigint, p_file_type text, p_dimensions jsonb, p_uploaded_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.check_upload_rate_limit(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.update_product_rating_summary()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
DECLARE
  product_uuid UUID;
  avg_rating DECIMAL(3,2);
  review_count INTEGER;
  rating_dist JSONB;
BEGIN
  -- Get the product_id from either NEW or OLD record
  product_uuid := COALESCE(NEW.product_id, OLD.product_id);
  
  -- Calculate new statistics
  SELECT 
    ROUND(AVG(rating), 2),
    COUNT(*),
    jsonb_build_object(
      '1', COUNT(*) FILTER (WHERE rating = 1),
      '2', COUNT(*) FILTER (WHERE rating = 2),
      '3', COUNT(*) FILTER (WHERE rating = 3),
      '4', COUNT(*) FILTER (WHERE rating = 4),
      '5', COUNT(*) FILTER (WHERE rating = 5)
    )
  INTO avg_rating, review_count, rating_dist
  FROM public.product_reviews 
  WHERE product_id = product_uuid AND status = 'active';
  
  -- Upsert the summary
  INSERT INTO public.product_ratings_summary (
    product_id, 
    average_rating, 
    total_reviews, 
    rating_distribution, 
    last_updated
  ) 
  VALUES (
    product_uuid, 
    COALESCE(avg_rating, 0), 
    COALESCE(review_count, 0), 
    COALESCE(rating_dist, '{"1":0,"2":0,"3":0,"4":0,"5":0}'), 
    NOW()
  )
  ON CONFLICT (product_id) 
  DO UPDATE SET
    average_rating = EXCLUDED.average_rating,
    total_reviews = EXCLUDED.total_reviews,
    rating_distribution = EXCLUDED.rating_distribution,
    last_updated = EXCLUDED.last_updated;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_paystack_webhook_ip(request_ip inet)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_catalog
AS $function$
DECLARE
  allowed_ips inet[] := ARRAY[
    '52.31.139.75'::inet,
    '52.49.173.169'::inet,
    '52.214.14.220'::inet,
    '54.154.89.105'::inet,
    '54.154.151.138'::inet,
    '54.217.79.138'::inet
  ];
  ip inet;
BEGIN
  -- Allow localhost for development
  IF request_ip <<= '127.0.0.0/8'::inet OR request_ip <<= '::1'::inet THEN
    RETURN true;
  END IF;
  
  -- Check against Paystack's official IP ranges
  FOREACH ip IN ARRAY allowed_ips LOOP
    IF request_ip = ip THEN
      RETURN true;
    END IF;
  END LOOP;
  
  RETURN false;
END;
$function$;