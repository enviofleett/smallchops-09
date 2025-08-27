
-- 1) Create a compatibility view for templates
-- This maps the evolving enhanced_email_templates schema to a stable "email_templates" view
-- Columns exposed: template_key, is_active, subject, html_content, text_content

DROP VIEW IF EXISTS public.email_templates;

CREATE VIEW public.email_templates AS
SELECT
  eet.template_key,
  eet.is_active,
  COALESCE(eet.subject, eet.subject_template)       AS subject,
  COALESCE(eet.html_content, eet.html_template)     AS html_content,
  COALESCE(eet.text_content, eet.text_template)     AS text_content
FROM public.enhanced_email_templates AS eet;

-- No explicit GRANTs needed for Supabase Edge Functions (service role can read).
-- RLS is enforced on the underlying table.
