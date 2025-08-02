-- Create customer_addresses table for multiple delivery addresses
CREATE TABLE public.customer_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  address_type TEXT NOT NULL DEFAULT 'delivery', -- 'delivery', 'billing', 'other'
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Nigeria',
  is_default BOOLEAN NOT NULL DEFAULT false,
  delivery_instructions TEXT,
  landmark TEXT,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customer_preferences table for consolidated preferences
CREATE TABLE public.customer_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  sms_notifications BOOLEAN NOT NULL DEFAULT false,
  push_notifications BOOLEAN NOT NULL DEFAULT true,
  marketing_emails BOOLEAN NOT NULL DEFAULT true,
  order_updates BOOLEAN NOT NULL DEFAULT true,
  price_alerts BOOLEAN NOT NULL DEFAULT true,
  promotion_alerts BOOLEAN NOT NULL DEFAULT true,
  newsletter_subscription BOOLEAN NOT NULL DEFAULT false,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  preferred_currency TEXT NOT NULL DEFAULT 'NGN',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id)
);

-- Create profile_activity_log table for tracking profile changes
CREATE TABLE public.profile_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'profile_update', 'address_added', 'preferences_changed', etc.
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add additional fields to customer_accounts for enhanced profile
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE public.customer_accounts ADD COLUMN IF NOT EXISTS profile_completion_percentage INTEGER DEFAULT 0;

-- Enable RLS on new tables
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_addresses
CREATE POLICY "Customers can manage their own addresses" ON public.customer_addresses
FOR ALL USING (
  customer_id IN (
    SELECT customer_accounts.id FROM customer_accounts 
    WHERE customer_accounts.user_id = auth.uid()
  )
) WITH CHECK (
  customer_id IN (
    SELECT customer_accounts.id FROM customer_accounts 
    WHERE customer_accounts.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can view all addresses" ON public.customer_addresses
FOR SELECT USING (
  get_user_role(auth.uid()) = ANY(ARRAY['admin'::text, 'manager'::text, 'staff'::text])
);

-- RLS policies for customer_preferences
CREATE POLICY "Customers can manage their own preferences" ON public.customer_preferences
FOR ALL USING (
  customer_id IN (
    SELECT customer_accounts.id FROM customer_accounts 
    WHERE customer_accounts.user_id = auth.uid()
  )
) WITH CHECK (
  customer_id IN (
    SELECT customer_accounts.id FROM customer_accounts 
    WHERE customer_accounts.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can view all preferences" ON public.customer_preferences
FOR SELECT USING (
  get_user_role(auth.uid()) = ANY(ARRAY['admin'::text, 'manager'::text, 'staff'::text])
);

-- RLS policies for profile_activity_log
CREATE POLICY "Customers can view their own activity log" ON public.profile_activity_log
FOR SELECT USING (
  customer_id IN (
    SELECT customer_accounts.id FROM customer_accounts 
    WHERE customer_accounts.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert activity logs" ON public.profile_activity_log
FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can view all activity logs" ON public.profile_activity_log
FOR SELECT USING (
  get_user_role(auth.uid()) = ANY(ARRAY['admin'::text, 'manager'::text, 'staff'::text])
);

-- Create indexes for performance
CREATE INDEX idx_customer_addresses_customer_id ON public.customer_addresses(customer_id);
CREATE INDEX idx_customer_addresses_is_default ON public.customer_addresses(customer_id, is_default) WHERE is_default = true;
CREATE INDEX idx_customer_preferences_customer_id ON public.customer_preferences(customer_id);
CREATE INDEX idx_profile_activity_log_customer_id ON public.profile_activity_log(customer_id);
CREATE INDEX idx_profile_activity_log_created_at ON public.profile_activity_log(created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_customer_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_addresses_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_addresses_updated_at();

CREATE TRIGGER update_customer_preferences_updated_at
  BEFORE UPDATE ON public.customer_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_preferences_updated_at();

-- Function to calculate profile completion percentage
CREATE OR REPLACE FUNCTION calculate_profile_completion(customer_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  completion_score INTEGER := 0;
  customer_record RECORD;
  address_count INTEGER;
  preferences_exists BOOLEAN;
BEGIN
  -- Get customer account details
  SELECT * INTO customer_record 
  FROM customer_accounts 
  WHERE id = customer_uuid;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Basic info (40 points total)
  IF customer_record.name IS NOT NULL AND LENGTH(TRIM(customer_record.name)) > 0 THEN
    completion_score := completion_score + 15;
  END IF;
  
  IF customer_record.phone IS NOT NULL AND LENGTH(TRIM(customer_record.phone)) > 0 THEN
    completion_score := completion_score + 10;
  END IF;
  
  IF customer_record.date_of_birth IS NOT NULL THEN
    completion_score := completion_score + 10;
  END IF;
  
  IF customer_record.avatar_url IS NOT NULL THEN
    completion_score := completion_score + 5;
  END IF;
  
  -- Address (30 points)
  SELECT COUNT(*) INTO address_count 
  FROM customer_addresses 
  WHERE customer_id = customer_uuid;
  
  IF address_count > 0 THEN
    completion_score := completion_score + 30;
  END IF;
  
  -- Preferences (20 points)
  SELECT EXISTS(
    SELECT 1 FROM customer_preferences 
    WHERE customer_id = customer_uuid
  ) INTO preferences_exists;
  
  IF preferences_exists THEN
    completion_score := completion_score + 20;
  END IF;
  
  -- Verification (10 points)
  IF customer_record.email_verified = true THEN
    completion_score := completion_score + 5;
  END IF;
  
  IF customer_record.phone_verified = true THEN
    completion_score := completion_score + 5;
  END IF;
  
  RETURN LEAST(completion_score, 100);
END;
$$ LANGUAGE plpgsql;

-- Function to log profile activities
CREATE OR REPLACE FUNCTION log_profile_activity(
  p_customer_id UUID,
  p_action_type TEXT,
  p_field_changed TEXT DEFAULT NULL,
  p_old_value TEXT DEFAULT NULL,
  p_new_value TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO profile_activity_log (
    customer_id, action_type, field_changed, old_value, new_value, ip_address, user_agent
  ) VALUES (
    p_customer_id, p_action_type, p_field_changed, p_old_value, p_new_value, p_ip_address, p_user_agent
  ) RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$ LANGUAGE plpgsql;