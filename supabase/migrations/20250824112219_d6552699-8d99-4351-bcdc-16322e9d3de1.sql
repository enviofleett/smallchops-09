
-- 1) Create the email templates table if missing
CREATE TABLE IF NOT EXISTS public.enhanced_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  template_name text NOT NULL,
  subject_template text NOT NULL,
  html_template text NOT NULL,
  text_template text NOT NULL DEFAULT '',
  variables text[] NOT NULL DEFAULT '{}',
  template_type text NOT NULL DEFAULT 'transactional',
  category text NOT NULL DEFAULT 'transactional',
  style text NOT NULL DEFAULT 'clean',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Ensure required columns exist (idempotent updates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='enhanced_email_templates' AND column_name='created_by'
  ) THEN
    ALTER TABLE public.enhanced_email_templates ADD COLUMN created_by uuid NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='enhanced_email_templates' AND column_name='updated_by'
  ) THEN
    ALTER TABLE public.enhanced_email_templates ADD COLUMN updated_by uuid NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='enhanced_email_templates' AND column_name='category'
  ) THEN
    ALTER TABLE public.enhanced_email_templates ADD COLUMN category text NOT NULL DEFAULT 'transactional';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='enhanced_email_templates' AND column_name='style'
  ) THEN
    ALTER TABLE public.enhanced_email_templates ADD COLUMN style text NOT NULL DEFAULT 'clean';
  END IF;
END$$;

-- 3) If the variables column is jsonb, convert it to text[] safely
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='enhanced_email_templates' 
      AND column_name='variables' AND data_type='jsonb'
  ) THEN
    ALTER TABLE public.enhanced_email_templates
    ALTER COLUMN variables TYPE text[]
    USING CASE 
      WHEN jsonb_typeof(variables)='array' THEN 
        ARRAY(SELECT jsonb_array_elements_text(variables))
      ELSE ARRAY[]::text[]
    END;
  END IF;
END$$;

-- 4) Enforce unique template_key (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS enhanced_email_templates_key_lower_uniq 
  ON public.enhanced_email_templates (lower(template_key));

-- 5) Validate template_key format (lowercase letters, digits, underscore, hyphen, dot)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_enhanced_email_templates_template_key_format'
  ) THEN
    ALTER TABLE public.enhanced_email_templates
      ADD CONSTRAINT chk_enhanced_email_templates_template_key_format
      CHECK (template_key ~ '^[a-z0-9_.-]+$');
  END IF;
END$$;

-- 6) Template type validation (optional: transactional/marketing/system/notification)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_enhanced_email_templates_template_type'
  ) THEN
    ALTER TABLE public.enhanced_email_templates
      ADD CONSTRAINT chk_enhanced_email_templates_template_type
      CHECK (template_type IN ('transactional', 'marketing', 'notification', 'system'));
  END IF;
END$$;

-- 7) Enable RLS and add policies
ALTER TABLE public.enhanced_email_templates ENABLE ROW LEVEL SECURITY;

-- Admins can manage all templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
      AND tablename='enhanced_email_templates' 
      AND policyname='Admins can manage email templates'
  ) THEN
    CREATE POLICY "Admins can manage email templates"
      ON public.enhanced_email_templates
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END$$;

-- Public can view only active templates (to keep client reads working)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
      AND tablename='enhanced_email_templates' 
      AND policyname='Public can view active email templates'
  ) THEN
    CREATE POLICY "Public can view active email templates"
      ON public.enhanced_email_templates
      FOR SELECT
      USING (is_active = true);
  END IF;
END$$;

-- 8) Use the shared updated_at trigger if not already attached
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_enhanced_email_templates_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_enhanced_email_templates_set_updated_at
      BEFORE UPDATE ON public.enhanced_email_templates
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

-- 9) Set created_by/updated_by automatically
CREATE OR REPLACE FUNCTION public.set_enhanced_email_templates_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.updated_by := COALESCE(NEW.updated_by, auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  END IF;
  RETURN NEW;
END;
$fn$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_enhanced_email_templates_set_user'
  ) THEN
    CREATE TRIGGER trg_enhanced_email_templates_set_user
      BEFORE INSERT OR UPDATE ON public.enhanced_email_templates
      FOR EACH ROW EXECUTE FUNCTION public.set_enhanced_email_templates_user();
  END IF;
END$$;

-- 10) Versioning table: full snapshot per change
CREATE TABLE IF NOT EXISTS public.enhanced_email_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.enhanced_email_templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by uuid NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS enhanced_email_template_versions_unique 
  ON public.enhanced_email_template_versions (template_id, version_number);

CREATE INDEX IF NOT EXISTS enhanced_email_template_versions_tid_idx 
  ON public.enhanced_email_template_versions (template_id);

-- 11) RLS for versions (admin-only)
ALTER TABLE public.enhanced_email_template_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
      AND tablename='enhanced_email_template_versions' 
      AND policyname='Admins can manage email template versions'
  ) THEN
    CREATE POLICY "Admins can manage email template versions"
      ON public.enhanced_email_template_versions
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END$$;

-- 12) Trigger that creates initial and subsequent versions
CREATE OR REPLACE FUNCTION public.log_enhanced_email_template_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  next_version integer;
  snapshot_data jsonb;
  actor uuid;
BEGIN
  actor := auth.uid();

  snapshot_data := jsonb_build_object(
    'template_key', NEW.template_key,
    'template_name', NEW.template_name,
    'subject_template', NEW.subject_template,
    'html_template', NEW.html_template,
    'text_template', NEW.text_template,
    'variables', NEW.variables,
    'template_type', NEW.template_type,
    'category', NEW.category,
    'style', NEW.style,
    'is_active', NEW.is_active,
    'created_at', NEW.created_at,
    'updated_at', NEW.updated_at,
    'created_by', NEW.created_by,
    'updated_by', NEW.updated_by
  );

  IF TG_OP = 'INSERT' THEN
    next_version := 1;
  ELSE
    SELECT COALESCE(MAX(version_number), 0) + 1
      INTO next_version
    FROM public.enhanced_email_template_versions
    WHERE template_id = NEW.id;
  END IF;

  INSERT INTO public.enhanced_email_template_versions (
    template_id, version_number, snapshot, changed_by, changed_at
  ) VALUES (
    NEW.id, next_version, snapshot_data, actor, now()
  );

  RETURN NEW;
END;
$fn$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_enhanced_email_templates_version_on_insert'
  ) THEN
    CREATE TRIGGER trg_enhanced_email_templates_version_on_insert
      AFTER INSERT ON public.enhanced_email_templates
      FOR EACH ROW EXECUTE FUNCTION public.log_enhanced_email_template_version();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_enhanced_email_templates_version_on_update'
  ) THEN
    CREATE TRIGGER trg_enhanced_email_templates_version_on_update
      AFTER UPDATE ON public.enhanced_email_templates
      FOR EACH ROW EXECUTE FUNCTION public.log_enhanced_email_template_version();
  END IF;
END$$;
