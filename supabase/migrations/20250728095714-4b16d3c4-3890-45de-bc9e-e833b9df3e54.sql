-- Fix RLS policy for communication_events to allow admin testing
-- First, add a policy to allow admins to insert test events
CREATE POLICY "Admins can insert communication events for testing" 
ON public.communication_events 
FOR INSERT 
WITH CHECK (
  (get_user_role(auth.uid()) = 'admin'::text)
);

-- Also allow admins to update communication events for testing purposes
CREATE POLICY "Admins can update communication events" 
ON public.communication_events 
FOR UPDATE 
USING (get_user_role(auth.uid()) = 'admin'::text);