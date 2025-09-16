-- Create delivery holidays table for managing blocked dates
CREATE TABLE public.delivery_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL UNIQUE,
  description TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create delivery bookings table for storing customer bookings
CREATE TABLE public.delivery_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  order_id UUID,
  delivery_date DATE NOT NULL,
  delivery_time_start TIME NOT NULL,
  delivery_time_end TIME NOT NULL,
  delivery_address JSONB NOT NULL,
  special_instructions TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed', 'rescheduled')),
  driver_id UUID,
  estimated_arrival TIMESTAMP WITH TIME ZONE,
  actual_arrival TIMESTAMP WITH TIME ZONE,
  delivery_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create delivery booking analytics table for tracking booking patterns
CREATE TABLE public.delivery_booking_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.delivery_bookings(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  booking_time_slot TEXT NOT NULL,
  advance_booking_days INTEGER NOT NULL,
  customer_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_delivery_bookings_date_time ON public.delivery_bookings(delivery_date, delivery_time_start, delivery_time_end);
CREATE INDEX idx_delivery_bookings_customer ON public.delivery_bookings(customer_id);
CREATE INDEX idx_delivery_bookings_status ON public.delivery_bookings(status);
CREATE INDEX idx_delivery_booking_analytics_date ON public.delivery_booking_analytics(booking_date);
CREATE INDEX idx_delivery_booking_analytics_customer ON public.delivery_booking_analytics(customer_id);

-- Enable Row Level Security
ALTER TABLE public.delivery_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_booking_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_holidays (readable by everyone, admin only for modifications)
CREATE POLICY "Delivery holidays are viewable by everyone" 
ON public.delivery_holidays 
FOR SELECT 
USING (true);

-- RLS Policies for delivery_bookings (customers can only see their own bookings)
CREATE POLICY "Customers can view their own bookings" 
ON public.delivery_bookings 
FOR SELECT 
USING (auth.uid() = customer_id);

CREATE POLICY "Customers can create their own bookings" 
ON public.delivery_bookings 
FOR INSERT 
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their own bookings" 
ON public.delivery_bookings 
FOR UPDATE 
USING (auth.uid() = customer_id);

-- RLS Policies for analytics (customers can view their own analytics)
CREATE POLICY "Customers can view their own booking analytics" 
ON public.delivery_booking_analytics 
FOR SELECT 
USING (auth.uid() = customer_id);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_delivery_booking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_delivery_bookings_updated_at
    BEFORE UPDATE ON public.delivery_bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_delivery_booking_updated_at();

-- Insert some common holidays
INSERT INTO public.delivery_holidays (name, date, description, is_recurring) VALUES
('New Year''s Day', '2024-01-01', 'New Year holiday', true),
('Christmas Day', '2024-12-25', 'Christmas holiday', true),
('Boxing Day', '2024-12-26', 'Boxing Day holiday', true),
('Good Friday', '2024-04-19', 'Good Friday holiday', false),
('Easter Monday', '2024-04-22', 'Easter Monday holiday', false);