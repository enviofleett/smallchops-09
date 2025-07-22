
-- Create enum for content types
CREATE TYPE public.content_type AS ENUM (
  'about_us',
  'terms_of_service',
  'privacy_policy',
  'contact_info',
  'faq',
  'help_center'
);

-- Create site_content table
CREATE TABLE public.site_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type public.content_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_published BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  seo_title TEXT,
  seo_description TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE,
  unpublished_at TIMESTAMP WITH TIME ZONE
);

-- Create content_versions table for version history
CREATE TABLE public.content_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL REFERENCES public.site_content(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  change_summary TEXT
);

-- Enable RLS on both tables
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies for site_content (admin only for management)
CREATE POLICY "Admins can manage all content" 
  ON public.site_content 
  FOR ALL 
  USING (public.is_admin());

-- RLS policies for content_versions (admin only)
CREATE POLICY "Admins can view content versions" 
  ON public.content_versions 
  FOR ALL 
  USING (public.is_admin());

-- Create trigger to update updated_at timestamp
CREATE TRIGGER set_updated_at_site_content
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Create trigger to log content changes
CREATE OR REPLACE FUNCTION public.log_content_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into content_versions table
  INSERT INTO public.content_versions (
    content_id,
    version,
    title,
    content,
    changed_by,
    change_summary
  ) VALUES (
    NEW.id,
    NEW.version,
    NEW.title,
    NEW.content,
    NEW.updated_by,
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'Content created'
      WHEN TG_OP = 'UPDATE' THEN 'Content updated'
      ELSE 'Content modified'
    END
  );

  -- Log to audit_logs
  INSERT INTO public.audit_logs (
    user_id,
    action,
    category,
    entity_type,
    entity_id,
    message,
    old_values,
    new_values
  ) VALUES (
    NEW.updated_by,
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'created'
      WHEN TG_OP = 'UPDATE' THEN 'updated'
      ELSE 'modified'
    END,
    'Content Management',
    'site_content',
    NEW.id,
    CONCAT('Content "', NEW.title, '" was ', 
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'created'
        WHEN TG_OP = 'UPDATE' THEN 'updated'
        ELSE 'modified'
      END
    ),
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for content change logging
CREATE TRIGGER log_content_changes
  AFTER INSERT OR UPDATE ON public.site_content
  FOR EACH ROW
  EXECUTE FUNCTION public.log_content_change();

-- Insert default content entries
INSERT INTO public.site_content (content_type, title, content, slug, is_published) VALUES
('about_us', 'About Us', '<h2>Welcome to DotCrafts</h2><p>We are a leading business management platform dedicated to helping businesses streamline their operations and achieve success.</p>', 'about-us', true),
('terms_of_service', 'Terms of Service', '<h2>Terms of Service</h2><p>Please read these terms carefully before using our services.</p><h3>1. Acceptance of Terms</h3><p>By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement.</p>', 'terms-of-service', true),
('privacy_policy', 'Privacy Policy', '<h2>Privacy Policy</h2><p>Your privacy is important to us. This privacy statement explains the personal data we process, how we process it, and for what purposes.</p>', 'privacy-policy', true);
