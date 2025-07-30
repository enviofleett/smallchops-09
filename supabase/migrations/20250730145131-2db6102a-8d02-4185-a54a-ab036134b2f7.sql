-- Create email_unsubscribes table for unsubscribe management
CREATE TABLE public.email_unsubscribes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_address TEXT NOT NULL,
  unsubscribe_type TEXT NOT NULL DEFAULT 'all' CHECK (unsubscribe_type IN ('all', 'marketing', 'transactional')),
  unsubscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT,
  ip_address INET,
  user_agent TEXT
);

-- Enable RLS on email_unsubscribes
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Create policies for email_unsubscribes
CREATE POLICY "Service roles can manage unsubscribes" 
ON public.email_unsubscribes 
FOR ALL 
USING (auth.role() = 'service_role') 
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view unsubscribes" 
ON public.email_unsubscribes 
FOR SELECT 
USING (is_admin());

-- Create unique constraint to prevent duplicate unsubscribes
CREATE UNIQUE INDEX idx_email_unsubscribes_unique ON public.email_unsubscribes(email_address, unsubscribe_type);

-- Create function to check if an email can be sent
CREATE OR REPLACE FUNCTION public.can_send_email_to(
  email_address TEXT,
  email_type TEXT DEFAULT 'transactional'
) 
RETURNS BOOLEAN 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.email_unsubscribes 
    WHERE email_unsubscribes.email_address = can_send_email_to.email_address
    AND (
      unsubscribe_type = 'all' 
      OR (email_type = 'marketing' AND unsubscribe_type = 'marketing')
    )
  );
$$;