-- Create enhanced_email_templates table for template management
CREATE TABLE public.enhanced_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  template_name TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  html_template TEXT NOT NULL,
  text_template TEXT,
  variables TEXT[] DEFAULT '{}',
  template_type TEXT NOT NULL DEFAULT 'transactional' CHECK (template_type IN ('order', 'customer', 'marketing', 'admin', 'transactional')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Enable RLS on enhanced_email_templates
ALTER TABLE public.enhanced_email_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for enhanced_email_templates
CREATE POLICY "Admins can manage email templates" 
ON public.enhanced_email_templates 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Service roles can read active templates" 
ON public.enhanced_email_templates 
FOR SELECT 
USING (auth.role() = 'service_role' AND is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_enhanced_email_templates_updated_at
BEFORE UPDATE ON public.enhanced_email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_enhanced_email_templates_key ON public.enhanced_email_templates(template_key);
CREATE INDEX idx_enhanced_email_templates_type ON public.enhanced_email_templates(template_type);
CREATE INDEX idx_enhanced_email_templates_active ON public.enhanced_email_templates(is_active);