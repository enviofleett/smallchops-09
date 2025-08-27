-- Migration: Create compatibility view for public.email_templates
-- This view maps legacy email_templates fields to enhanced_email_templates, handling nulls for backwards compatibility.

create or replace view public.email_templates as
select
  eet.id,
  eet.template_type,
  eet.subject,
  eet.body,
  eet.created_at,
  eet.updated_at,
  eet.deleted_at,
  eet.is_active,
  eet.language,
  eet.user_id,
  COALESCE(eet.extra_field1, '') as extra_field1,
  COALESCE(eet.extra_field2, '') as extra_field2
from public.enhanced_email_templates eet
where eet.deleted_at is null;