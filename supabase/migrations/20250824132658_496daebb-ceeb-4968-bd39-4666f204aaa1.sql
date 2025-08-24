-- Create or update the log_email_delivery function to match the new parameters
CREATE OR REPLACE FUNCTION public.log_email_delivery(
  p_message_id text, 
  p_recipient_email text, 
  p_subject text, 
  p_provider text, 
  p_status text, 
  p_template_key text DEFAULT NULL::text, 
  p_variables jsonb DEFAULT '{}'::jsonb, 
  p_smtp_response text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert into delivery confirmations
  INSERT INTO smtp_delivery_confirmations (
    email_id,
    recipient_email,
    provider_used,
    delivery_status,
    message_id,
    provider_response,
    created_at
  ) VALUES (
    p_message_id,
    p_recipient_email,
    p_provider,
    p_status,
    p_message_id,
    jsonb_build_object('response', p_smtp_response),
    NOW()
  );

  -- Insert into SMTP delivery logs
  INSERT INTO smtp_delivery_logs (
    email_id,
    recipient_email,
    subject,
    delivery_status,
    provider,
    smtp_response,
    delivery_timestamp,
    metadata
  ) VALUES (
    p_message_id,
    p_recipient_email,
    p_subject,
    p_status,
    p_provider,
    p_smtp_response,
    NOW(),
    jsonb_build_object(
      'template_key', p_template_key,
      'variables', p_variables,
      'logged_at', NOW()
    )
  );
END;
$function$;

-- Create email analytics view for monitoring
CREATE OR REPLACE VIEW public.email_delivery_analytics AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_emails,
  SUM(CASE WHEN delivery_status = 'sent' THEN 1 ELSE 0 END) as sent_emails,
  SUM(CASE WHEN delivery_status = 'failed' THEN 1 ELSE 0 END) as failed_emails,
  SUM(CASE WHEN delivery_status = 'bounced' THEN 1 ELSE 0 END) as bounced_emails,
  ROUND(
    (SUM(CASE WHEN delivery_status = 'sent' THEN 1 ELSE 0 END)::decimal / COUNT(*)) * 100, 
    2
  ) as success_rate_percent
FROM smtp_delivery_confirmations 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;