-- Create payment polling state table for tracking polling status
CREATE TABLE IF NOT EXISTS public.payment_polling_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  retry_count INTEGER NOT NULL DEFAULT 0,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_polled TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'timeout', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_payment_polling_state_reference ON public.payment_polling_state(reference);
CREATE INDEX IF NOT EXISTS idx_payment_polling_state_status ON public.payment_polling_state(status);

-- Enable RLS
ALTER TABLE public.payment_polling_state ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment polling state
CREATE POLICY "Service roles can manage payment polling state" 
ON public.payment_polling_state
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view payment polling state" 
ON public.payment_polling_state
FOR SELECT 
TO authenticated
USING (is_admin());

-- Add webhook events table if not exists for enhanced tracking
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paystack_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processing_result JSONB,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for webhook events
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(paystack_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON public.webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(processed);

-- Enable RLS for webhook events
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for webhook events
CREATE POLICY "Service roles can manage webhook events" 
ON public.webhook_events
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view webhook events" 
ON public.webhook_events
FOR SELECT 
TO authenticated
USING (is_admin());

-- Create function to enable pg_notify for real-time payments
CREATE OR REPLACE FUNCTION public.pg_notify(channel TEXT, payload TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM pg_notify(channel, payload);
END;
$function$;

-- Grant execute permission on pg_notify function
GRANT EXECUTE ON FUNCTION public.pg_notify(TEXT, TEXT) TO service_role;

-- Create updated_at trigger for payment_polling_state
CREATE OR REPLACE FUNCTION public.update_payment_polling_state_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER update_payment_polling_state_updated_at
  BEFORE UPDATE ON public.payment_polling_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payment_polling_state_timestamp();

-- Add realtime publication for payment_transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_transactions;

-- Set replica identity for real-time updates
ALTER TABLE public.payment_transactions REPLICA IDENTITY FULL;

-- Log the migration
INSERT INTO public.audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'enhanced_payment_system_migration',
  'System',
  'Enhanced payment system with webhook security and polling implemented',
  jsonb_build_object(
    'features', ARRAY[
      'payment_polling_state_table',
      'webhook_events_table', 
      'pg_notify_function',
      'realtime_payment_updates',
      'enhanced_security_measures'
    ],
    'migration_date', NOW()
  )
);