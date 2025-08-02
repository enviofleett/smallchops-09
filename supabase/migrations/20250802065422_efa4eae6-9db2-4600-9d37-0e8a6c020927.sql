-- Create trigger for real-time email processing
CREATE OR REPLACE FUNCTION public.trigger_email_processing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only process newly queued emails
  IF TG_OP = 'INSERT' AND NEW.status = 'queued' THEN
    -- Immediately invoke the email processing function
    PERFORM net.http_post(
      url := 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/process-communication-events-enhanced',
      headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzE5MDkxNCwiZXhwIjoyMDY4NzY2OTE0fQ.qLhXiVUKvNPZCm2Ea-ZYZLwvdgDfV3ZM_5NlGPHQh1c", "Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('immediate_processing', true, 'event_id', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS real_time_email_trigger ON communication_events;
CREATE TRIGGER real_time_email_trigger
  AFTER INSERT ON communication_events
  FOR EACH ROW
  EXECUTE FUNCTION trigger_email_processing();

-- Add email delivery confirmation tracking
CREATE TABLE IF NOT EXISTS email_delivery_confirmations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  communication_event_id uuid REFERENCES communication_events(id) ON DELETE CASCADE,
  delivery_status text NOT NULL CHECK (delivery_status IN ('sent', 'delivered', 'bounced', 'complained', 'failed')),
  provider_response jsonb,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT NOW(),
  updated_at timestamp with time zone DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_email_delivery_confirmations_event_id ON email_delivery_confirmations(communication_event_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_confirmations_status ON email_delivery_confirmations(delivery_status);

-- Enable RLS
ALTER TABLE email_delivery_confirmations ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Admins can manage delivery confirmations"
ON email_delivery_confirmations
FOR ALL
USING (is_admin());