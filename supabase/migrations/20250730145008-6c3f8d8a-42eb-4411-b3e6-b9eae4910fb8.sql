-- Create smtp_delivery_logs table for tracking SMTP email delivery
CREATE TABLE public.smtp_delivery_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT,
  recipient_email TEXT NOT NULL,
  sender_email TEXT,
  subject TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'queued' CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed')),
  provider TEXT NOT NULL DEFAULT 'smtp' CHECK (provider IN ('smtp', 'mailersend')),
  error_message TEXT,
  smtp_response TEXT,
  delivery_timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on smtp_delivery_logs
ALTER TABLE public.smtp_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for smtp_delivery_logs
CREATE POLICY "Admins can view all SMTP delivery logs" 
ON public.smtp_delivery_logs 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Service roles can manage SMTP delivery logs" 
ON public.smtp_delivery_logs 
FOR ALL 
USING (auth.role() = 'service_role') 
WITH CHECK (auth.role() = 'service_role');

-- Create index for better performance
CREATE INDEX idx_smtp_delivery_logs_recipient ON public.smtp_delivery_logs(recipient_email);
CREATE INDEX idx_smtp_delivery_logs_status ON public.smtp_delivery_logs(delivery_status);
CREATE INDEX idx_smtp_delivery_logs_created_at ON public.smtp_delivery_logs(created_at DESC);