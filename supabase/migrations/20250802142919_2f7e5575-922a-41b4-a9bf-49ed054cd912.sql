-- Create about_us_sections table for managing different sections of the about page
CREATE TABLE public.about_us_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_type TEXT NOT NULL, -- 'hero', 'story', 'values', 'team_intro', 'contact'
  title TEXT,
  content TEXT,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  seo_title TEXT,
  seo_description TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(section_type)
);

-- Create team_members table for managing team member profiles
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  bio TEXT,
  image_url TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create about_us_gallery table for managing company photos
CREATE TABLE public.about_us_gallery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  description TEXT,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  category TEXT DEFAULT 'general', -- 'office', 'team', 'events', 'products', 'general'
  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.about_us_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.about_us_gallery ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for about_us_sections
CREATE POLICY "Admins can manage about sections" ON public.about_us_sections
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Public can view published about sections" ON public.about_us_sections
  FOR SELECT USING (is_published = true);

-- Create RLS policies for team_members
CREATE POLICY "Admins can manage team members" ON public.team_members
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Public can view active team members" ON public.team_members
  FOR SELECT USING (is_active = true);

-- Create RLS policies for about_us_gallery
CREATE POLICY "Admins can manage gallery" ON public.about_us_gallery
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Public can view published gallery items" ON public.about_us_gallery
  FOR SELECT USING (is_published = true);

-- Create triggers for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_about_us_sections_updated_at
  BEFORE UPDATE ON public.about_us_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_about_us_gallery_updated_at
  BEFORE UPDATE ON public.about_us_gallery
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default sections
INSERT INTO public.about_us_sections (section_type, title, content, sort_order) VALUES
('hero', 'Welcome to Starters Small Chops, Where Every Bite Tells a Story.', 'At Starters small chops, we believe great food brings people together. What started as a passion for crafting irresistible finger foods has grown into a trusted name for delicious, freshly-made small chops delivered with love.', 1),
('story', 'About Us', 'At Starters small chops, we believe great food brings people together. What started as a passion for crafting irresistible finger foods has grown into a trusted name for delicious, freshly-made small chops delivered with love.', 2),
('values', 'Why Choose Us?', 'Fresh ingredients, never frozen\n\nMaximum flavor and crunch\n\nTimely delivery with a smile\n\nCustomizable packages for events\n\nWe''re not just serving small chops, we''re serving joy, one plate at a time.', 3),
('team_intro', 'Our Team', 'Meet our team of chop masters, spice mixers, and snack slingers, the crew behind your favorite finger foods!', 4),
('contact', 'Get In Touch', 'Ready to order or have questions? Contact us today!', 5);