
-- 1. Create a new ENUM type for communication log statuses
CREATE TYPE public.communication_log_status AS ENUM (
  'sent',
  'delivered',
  'bounced',
  'failed',
  'skipped' -- For when a trigger is disabled or no recipient
);

-- 2. Create the communication_logs table
CREATE TABLE public.communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.communication_events(id) ON DELETE SET NULL, -- Keep logs even if the event is cleaned up
  order_id UUID NOT NULL,
  channel TEXT NOT NULL, -- 'email' or 'sms'
  recipient TEXT NOT NULL,
  status public.communication_log_status NOT NULL,
  template_name TEXT,
  subject TEXT, -- For emails
  provider_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comments for clarity
COMMENT ON COLUMN public.communication_logs.event_id IS 'Link to the originating event in the queue.';
COMMENT ON COLUMN public.communication_logs.status IS 'The final status of the communication attempt.';
COMMENT ON COLUMN public.communication_logs.provider_response IS 'Raw response from the email/SMS provider for debugging.';

-- 3. Add indexes for efficient querying
CREATE INDEX idx_comm_logs_event_id ON public.communication_logs (event_id);
CREATE INDEX idx_comm_logs_order_id ON public.communication_logs (order_id);
CREATE INDEX idx_comm_logs_status ON public.communication_logs (status);
CREATE INDEX idx_comm_logs_created_at ON public.communication_logs (created_at DESC);

-- 4. Set up Row Level Security
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Allow admins and managers to view logs
-- We assume a function `get_user_role` exists.
CREATE POLICY "Admins and managers can view communication logs"
ON public.communication_logs FOR SELECT
USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

-- 6. RLS Policies: Allow service role to insert logs (from edge function)
CREATE POLICY "Service roles can insert communication logs"
ON public.communication_logs FOR INSERT
WITH CHECK (auth.role() = 'service_role');
