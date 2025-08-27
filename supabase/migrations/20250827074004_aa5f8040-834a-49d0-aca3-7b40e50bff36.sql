-- Create email_templates view mapping to enhanced_email_templates
CREATE OR REPLACE VIEW public.email_templates AS
SELECT 
    id,
    template_key,
    subject,
    content,
    html_content,
    variables,
    is_active,
    created_at,
    updated_at,
    created_by,
    updated_by
FROM public.enhanced_email_templates;

-- Grant appropriate permissions
GRANT SELECT ON public.email_templates TO anon, authenticated;

-- Enable RLS on the view
ALTER VIEW public.email_templates SET (security_invoker = on);