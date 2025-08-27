
-- Store SMTP credentials in communication_settings (DB-first usage)
-- Note: This inserts a fresh row (latest one will be used by the function)
INSERT INTO public.communication_settings (
  smtp_host,
  smtp_port,
  smtp_user,
  smtp_pass,
  smtp_secure,
  sender_email,
  sender_name,
  use_smtp,
  email_provider,
  created_at,
  updated_at
) VALUES (
  'smtp.yournotify.com',
  587,
  'store@startersmallchops.com',
  'EVi4fbDA18',
  false, -- Port 587 expects STARTTLS (not implicit SSL)
  'store@startersmallchops.com',
  'Starters Small Chops',
  true,
  'smtp',
  NOW(),
  NOW()
);
