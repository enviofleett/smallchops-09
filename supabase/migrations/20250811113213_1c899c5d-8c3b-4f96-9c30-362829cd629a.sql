-- Update SMTP settings to default to port 587 with STARTTLS for better serverless compatibility
UPDATE communication_settings 
SET 
  smtp_port = 587,
  smtp_secure = false
WHERE smtp_port = 465;

-- Add improved SMTP config function with port fallback
CREATE OR REPLACE FUNCTION get_smtp_config_with_fallback()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config RECORD;
  v_result JSONB;
BEGIN
  -- Get latest SMTP configuration
  SELECT * INTO v_config
  FROM communication_settings
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'primary', jsonb_build_object(
        'host', 'mail.startersmallchops.com',
        'port', 587,
        'auth', jsonb_build_object(
          'user', 'store@startersmallchops.com',
          'pass', ''
        ),
        'secure', false
      ),
      'fallback', jsonb_build_object(
        'host', 'mail.startersmallchops.com',
        'port', 465,
        'auth', jsonb_build_object(
          'user', 'store@startersmallchops.com',
          'pass', ''
        ),
        'secure', true
      ),
      'timeout', 15000,
      'retry_attempts', 2
    );
  END IF;
  
  -- Build configuration with primary (STARTTLS) and fallback (SSL) options
  v_result := jsonb_build_object(
    'primary', jsonb_build_object(
      'host', v_config.smtp_host,
      'port', 587,
      'auth', jsonb_build_object(
        'user', v_config.smtp_user,
        'pass', v_config.smtp_pass
      ),
      'secure', false
    ),
    'fallback', jsonb_build_object(
      'host', v_config.smtp_host,
      'port', 465,
      'auth', jsonb_build_object(
        'user', v_config.smtp_user,
        'pass', v_config.smtp_pass
      ),
      'secure', true
    ),
    'timeout', 15000,
    'retry_attempts', 2
  );
  
  RETURN v_result;
END;
$$;