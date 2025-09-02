-- Fix enhanced email template system - Step 1: Add missing column and basic setup

-- Add full_html column if it doesn't exist
ALTER TABLE enhanced_email_templates 
ADD COLUMN IF NOT EXISTS full_html BOOLEAN DEFAULT false;

-- Enable RLS on enhanced_email_templates
ALTER TABLE enhanced_email_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for enhanced_email_templates
DROP POLICY IF EXISTS "Admins can manage email templates" ON enhanced_email_templates;
CREATE POLICY "Admins can manage email templates"
ON enhanced_email_templates
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Service roles can read templates" ON enhanced_email_templates;  
CREATE POLICY "Service roles can read templates"
ON enhanced_email_templates
FOR SELECT
USING (auth.role() = 'service_role');

-- Create enhanced_email_template_versions table for version control
CREATE TABLE IF NOT EXISTS enhanced_email_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL,
  template_key TEXT NOT NULL,
  template_name TEXT NOT NULL,
  subject_template TEXT,
  html_template TEXT,
  text_template TEXT,
  variables TEXT[],
  template_type TEXT DEFAULT 'transactional',
  category TEXT DEFAULT 'system',
  style TEXT DEFAULT 'default',
  is_active BOOLEAN DEFAULT true,
  full_html BOOLEAN DEFAULT false,
  version_number INTEGER NOT NULL DEFAULT 1,
  change_note TEXT,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on template versions
ALTER TABLE enhanced_email_template_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies for template versions
CREATE POLICY "Admins can manage template versions"
ON enhanced_email_template_versions
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());