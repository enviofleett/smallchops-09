-- Fix security warnings by enabling RLS on payment_logs table
-- This addresses the RLS_DISABLED_IN_PUBLIC security warning

-- Enable RLS on the payment_logs table
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for payment_logs table
CREATE POLICY "Admins can view all payment logs" ON public.payment_logs
  FOR SELECT USING (is_admin());

CREATE POLICY "Service roles can insert payment logs" ON public.payment_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- No update or delete policies - payment logs should be immutable