
-- Add missing column referenced by unified-smtp-sender logging
ALTER TABLE public.smtp_delivery_logs
  ADD COLUMN IF NOT EXISTS template_key text;
