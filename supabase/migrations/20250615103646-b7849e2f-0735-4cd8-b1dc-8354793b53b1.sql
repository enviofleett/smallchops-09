
-- Step 1: Create a table for customer communication preferences
CREATE TABLE public.customer_communication_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email TEXT NOT NULL UNIQUE,
  allow_order_updates BOOLEAN NOT NULL DEFAULT true,
  allow_promotions BOOLEAN NOT NULL DEFAULT true,
  preferred_channel TEXT NOT NULL DEFAULT 'any', -- 'email', 'sms', or 'any'
  language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add a trigger to automatically update the 'updated_at' timestamp
-- We will use the existing set_current_timestamp_updated_at function
CREATE TRIGGER handle_updated_at_customer_communication_preferences
BEFORE UPDATE ON public.customer_communication_preferences
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- Add comments for clarity
COMMENT ON TABLE public.customer_communication_preferences IS 'Stores customer choices for receiving communications.';
COMMENT ON COLUMN public.customer_communication_preferences.customer_email IS 'The unique email of the customer.';
COMMENT ON COLUMN public.customer_communication_preferences.allow_order_updates IS 'If the customer wants notifications about their orders.';
COMMENT ON COLUMN public.customer_communication_preferences.allow_promotions IS 'If the customer wants marketing/promotional messages.';
COMMENT ON COLUMN public.customer_communication_preferences.preferred_channel IS 'Customer''s preferred channel: ''email'', ''sms'', or ''any''.';
COMMENT ON COLUMN public.customer_communication_preferences.language IS 'Customer''s preferred language (e.g., ''en'', ''es'').';

-- Enable Row Level Security
ALTER TABLE public.customer_communication_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins and managers can view all preferences.
CREATE POLICY "Admins and managers can view preferences"
ON public.customer_communication_preferences FOR SELECT
USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

-- Service role (used by edge functions) can manage all preferences.
CREATE POLICY "Service roles can manage preferences"
ON public.customer_communication_preferences FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
