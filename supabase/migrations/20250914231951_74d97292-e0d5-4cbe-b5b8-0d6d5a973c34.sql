-- Fix the email_queue_health view security issue
-- First, get the current view definition and recreate with security_invoker
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

-- Ensure proper permissions on the view
REVOKE ALL ON VIEW public.email_queue_health FROM PUBLIC;
GRANT SELECT ON public.email_queue_health TO authenticated;

-- Add RLS policy for the view access
CREATE POLICY "Admins can view email queue health" 
ON public.email_queue_health 
FOR SELECT 
USING (is_admin());