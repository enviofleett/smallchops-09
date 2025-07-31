-- Create smtp_delivery_logs table for tracking email delivery (fixed)
CREATE TABLE IF NOT EXISTS public.smtp_delivery_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id TEXT,
  recipient_email TEXT NOT NULL,
  sender_email TEXT,
  subject TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'sent',
  provider TEXT NOT NULL DEFAULT 'smtp',
  error_message TEXT,
  smtp_response TEXT,
  email_type TEXT DEFAULT 'transactional',
  delivery_timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.smtp_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for smtp_delivery_logs
CREATE POLICY "Admins can view all smtp delivery logs" 
ON public.smtp_delivery_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Service roles can manage smtp delivery logs" 
ON public.smtp_delivery_logs 
FOR ALL 
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_smtp_delivery_logs_recipient ON public.smtp_delivery_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_smtp_delivery_logs_status ON public.smtp_delivery_logs(delivery_status);
CREATE INDEX IF NOT EXISTS idx_smtp_delivery_logs_created_at ON public.smtp_delivery_logs(created_at);