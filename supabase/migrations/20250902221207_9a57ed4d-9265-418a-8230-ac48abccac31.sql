-- Complete email template system - Step 2: Views, triggers, and functions

-- Create unified email_templates view
CREATE OR REPLACE VIEW email_templates AS
SELECT 
  template_key,
  template_name,
  subject_template as subject,
  html_template as html_content,
  text_template as text_content,
  variables,
  template_type,
  category,
  style,
  is_active,
  full_html,
  created_at,
  updated_at
FROM enhanced_email_templates
WHERE is_active = true;

-- Function to create template version on changes
CREATE OR REPLACE FUNCTION create_template_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert version record
  INSERT INTO enhanced_email_template_versions (
    template_id,
    template_key,
    template_name,
    subject_template,
    html_template, 
    text_template,
    variables,
    template_type,
    category,
    style,
    is_active,
    full_html,
    version_number,
    change_note,
    changed_by
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.template_key, OLD.template_key),
    COALESCE(NEW.template_name, OLD.template_name),
    COALESCE(NEW.subject_template, OLD.subject_template),
    COALESCE(NEW.html_template, OLD.html_template),
    COALESCE(NEW.text_template, OLD.text_template),
    COALESCE(NEW.variables, OLD.variables),
    COALESCE(NEW.template_type, OLD.template_type),
    COALESCE(NEW.category, OLD.category),
    COALESCE(NEW.style, OLD.style),
    COALESCE(NEW.is_active, OLD.is_active),
    COALESCE(NEW.full_html, OLD.full_html),
    COALESCE(
      (SELECT MAX(version_number) + 1 FROM enhanced_email_template_versions 
       WHERE template_id = COALESCE(NEW.id, OLD.id)), 
      1
    ),
    'Auto-versioned change',
    auth.uid()
  );

  -- Log audit entry
  INSERT INTO audit_logs (
    action,
    category, 
    message,
    user_id,
    entity_id,
    old_values,
    new_values
  ) VALUES (
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'email_template_created'
      WHEN TG_OP = 'UPDATE' THEN 'email_template_updated'
      WHEN TG_OP = 'DELETE' THEN 'email_template_deleted'
    END,
    'Email Templates',
    'Email template ' || TG_OP || ': ' || COALESCE(NEW.template_key, OLD.template_key),
    auth.uid(),
    COALESCE(NEW.id, OLD.id),
    CASE WHEN OLD IS NOT NULL THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN NEW IS NOT NULL THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for template versioning
DROP TRIGGER IF EXISTS template_versioning_trigger ON enhanced_email_templates;
CREATE TRIGGER template_versioning_trigger
  AFTER INSERT OR UPDATE OR DELETE ON enhanced_email_templates
  FOR EACH ROW
  EXECUTE FUNCTION create_template_version();

-- Create template health summary view
CREATE OR REPLACE VIEW email_template_health AS
SELECT 
  COUNT(*) as total_templates,
  COUNT(*) FILTER (WHERE is_active = true) as active_templates,
  COUNT(*) FILTER (WHERE template_type = 'transactional') as transactional_count,
  COUNT(*) FILTER (WHERE template_type = 'marketing') as marketing_count,
  COUNT(*) FILTER (WHERE updated_at < NOW() - INTERVAL '30 days') as stale_templates,
  MAX(updated_at) as last_updated
FROM enhanced_email_templates;