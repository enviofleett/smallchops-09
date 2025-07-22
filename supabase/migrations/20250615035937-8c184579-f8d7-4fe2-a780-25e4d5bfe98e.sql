
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE public.user_status AS ENUM ('active', 'inactive', 'pending');
    END IF;
END$$;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS status public.user_status NOT NULL DEFAULT 'active';
