-- Insert default business settings for Starters with proper structure
INSERT INTO business_settings (
  name, 
  tagline, 
  email, 
  phone, 
  address, 
  logo_url,
  seo_title,
  seo_description,
  facebook_url,
  instagram_url,
  twitter_url
) VALUES (
  'Starters',
  'Premium Small Chops & Catering Services',
  'info@starters.com',
  '+234-XXX-XXX-XXXX',
  'Lagos, Nigeria',
  '/lovable-uploads/4b7e8feb-69d6-41e6-bf51-31bc57291f4a.png',
  'Starters - Premium Small Chops & Catering',
  'Professional small chops and catering services in Lagos. Quality food for all your events and occasions.',
  'https://facebook.com/starters',
  'https://instagram.com/starters',
  'https://twitter.com/starters'
)
ON CONFLICT DO NOTHING;