-- Create table for hero images (section A)
CREATE TABLE public.hero_carousel_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create table for budget baller content (section B)
CREATE TABLE public.budget_baller_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'The Budget Baller',
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of item objects with name, quantity, etc
  background_color TEXT DEFAULT '#f59e0b',
  text_color TEXT DEFAULT '#1f2937',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on both tables
ALTER TABLE public.hero_carousel_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_baller_content ENABLE ROW LEVEL SECURITY;

-- RLS policies for hero_carousel_images
CREATE POLICY "Public can view active hero images" 
ON public.hero_carousel_images 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage hero images" 
ON public.hero_carousel_images 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

-- RLS policies for budget_baller_content
CREATE POLICY "Public can view active budget baller content" 
ON public.budget_baller_content 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage budget baller content" 
ON public.budget_baller_content 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hero_carousel_images_updated_at
BEFORE UPDATE ON public.hero_carousel_images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budget_baller_content_updated_at
BEFORE UPDATE ON public.budget_baller_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default budget baller content
INSERT INTO public.budget_baller_content (title, items) VALUES (
  'The Budget Baller',
  '[
    {"name": "5 Samosa", "included": true},
    {"name": "5 Spring Rolls", "included": true},
    {"name": "5 Stick Meat", "included": true},
    {"name": "20 Poff-Poff", "included": true}
  ]'::jsonb
);

-- Insert some default hero images
INSERT INTO public.hero_carousel_images (image_url, alt_text, display_order) VALUES 
('/lovable-uploads/6ce07f82-8658-4534-a584-2c507d3ff58c.png', 'Delicious snacks and treats', 1),
('/hero-family.jpg', 'Family enjoying small chops', 2);