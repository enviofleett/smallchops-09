
-- Add 'dispatch_rider' to the existing user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'dispatch_rider';

-- Add a column to the orders table to store the assigned rider's ID
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS assigned_rider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
