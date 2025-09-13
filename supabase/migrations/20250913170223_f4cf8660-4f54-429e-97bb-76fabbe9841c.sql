-- Add event_type and company fields to catering_bookings table
ALTER TABLE public.catering_bookings 
ADD COLUMN event_type text,
ADD COLUMN is_company_order boolean DEFAULT false,
ADD COLUMN company_name text;