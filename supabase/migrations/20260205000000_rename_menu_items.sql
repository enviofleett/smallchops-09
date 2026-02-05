-- Rename menu items as requested
UPDATE public.website_menu SET label = 'Menu' WHERE menu_key = 'shop';
UPDATE public.website_menu SET label = 'Events' WHERE menu_key = 'event';
UPDATE public.website_menu SET label = 'Our story' WHERE menu_key = 'about';
