-- Create catering bookings table for event catering requests
CREATE TABLE public.catering_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  event_date DATE NOT NULL,
  number_of_guests INTEGER NOT NULL,
  additional_details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  quote_amount DECIMAL(10,2),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.catering_bookings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public can submit catering requests" 
ON public.catering_bookings 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can view all catering bookings" 
ON public.catering_bookings 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Admins can update catering bookings" 
ON public.catering_bookings 
FOR UPDATE 
USING (is_admin());

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_catering_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_catering_bookings_updated_at
BEFORE UPDATE ON public.catering_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_catering_bookings_updated_at();