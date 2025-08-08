
-- Add guest checkout toggle to business settings
ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS allow_guest_checkout boolean NOT NULL DEFAULT true;
