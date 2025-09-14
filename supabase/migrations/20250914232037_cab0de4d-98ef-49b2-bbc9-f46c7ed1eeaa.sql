-- Fix the email_queue_health view security issue
-- Recreate with security_invoker to fix SECURITY DEFINER behavior
DROP VIEW IF EXISTS public.email_queue_health;

CREATE OR REPLACE VIEW public.email_queue_health 
WITH (security_invoker = on)
AS 
SELECT 
  COUNT(CASE WHEN status = 'queued' THEN 1 END) as queued_count,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
  COUNT(CASE WHEN status = 'queued' AND created_at < NOW() - INTERVAL '1 hour' THEN 1 END) as stuck_emails,
  MAX(CASE WHEN status = 'sent' THEN sent_at END) as last_email_sent,
  MIN(CASE WHEN status = 'queued' THEN created_at END) as oldest_queued_email
FROM public.communication_events
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Grant appropriate permissions (views don't have RLS, they inherit from underlying tables)
REVOKE ALL ON public.email_queue_health FROM PUBLIC;
GRANT SELECT ON public.email_queue_health TO authenticated;