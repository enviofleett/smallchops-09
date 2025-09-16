-- Create website_menu table for dynamic menu management
CREATE TABLE public.website_menu (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  url TEXT,
  parent_id UUID REFERENCES public.website_menu(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  target TEXT DEFAULT '_self', -- _self, _blank, etc.
  icon_name TEXT, -- lucide icon name
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Create header_banners table for admin-managed banners
CREATE TABLE public.header_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  background_color TEXT DEFAULT '#3b82f6',
  text_color TEXT DEFAULT '#ffffff',
  button_text TEXT,
  button_url TEXT,
  is_active BOOLEAN DEFAULT true,
  display_priority INTEGER DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Enable RLS
ALTER TABLE public.website_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.header_banners ENABLE ROW LEVEL SECURITY;

-- Create policies for website_menu
CREATE POLICY "Public can view active menu items" 
ON public.website_menu 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage menu items" 
ON public.website_menu 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

-- Create policies for header_banners
CREATE POLICY "Public can view active banners" 
ON public.header_banners 
FOR SELECT 
USING (
  is_active = true 
  AND (start_date IS NULL OR start_date <= now())
  AND (end_date IS NULL OR end_date >= now())
);

CREATE POLICY "Admins can manage banners" 
ON public.header_banners 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

-- Create triggers for updated_at
CREATE TRIGGER update_website_menu_updated_at
BEFORE UPDATE ON public.website_menu
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_header_banners_updated_at
BEFORE UPDATE ON public.header_banners
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Insert default menu items
INSERT INTO public.website_menu (menu_key, label, url, sort_order) VALUES
('home', 'Home', '/', 1),
('shop', 'Shop', '/products', 2),
('blog', 'Blog', '/blog', 3),
('event', 'Event', '/booking', 4),
('about', 'About', '/about', 5),
('contact', 'Contact', '/contact', 6);

-- Insert sample banner
INSERT INTO public.header_banners (title, description, background_color, text_color, is_active, display_priority)
VALUES ('Welcome to Our Store', 'Discover amazing products and great deals!', '#3b82f6', '#ffffff', false, 1);