
-- Remove unnecessary fields from business_settings table
ALTER TABLE public.business_settings 
DROP COLUMN IF EXISTS registration_number,
DROP COLUMN IF EXISTS tax_id,
DROP COLUMN IF EXISTS licenses;
