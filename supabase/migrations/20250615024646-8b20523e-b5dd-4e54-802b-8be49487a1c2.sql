
-- 1. Create the audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_time timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  user_name text,
  action text NOT NULL, -- "created", "updated", "deleted", "login", "export", etc.
  category text,        -- "Order", "Product", "Category", "User", etc.
  entity_type text,     -- e.g. "orders", "products", etc.
  entity_id uuid,       -- record id being changed
  message text,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text
);

-- 2. Useful indexes for filtering/searching
CREATE INDEX ON public.audit_logs (event_time DESC);
CREATE INDEX ON public.audit_logs (category);
CREATE INDEX ON public.audit_logs (user_id);
CREATE INDEX ON public.audit_logs (entity_type);
CREATE INDEX ON public.audit_logs (entity_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Allow only admins to view audit logs
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid();
$$;

CREATE POLICY "Admins can read all audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (public.is_admin());

-- 5. (Optional) Policy: allow insert from triggers/unprivileged users
CREATE POLICY "Anyone can insert logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

-- 6. Example (manual, not full) triggers: Orders
-- You should later expand these for other tables as needed
CREATE OR REPLACE FUNCTION public.log_order_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    category,
    entity_type,
    entity_id,
    message,
    old_values,
    new_values
  ) VALUES (
    NEW.updated_by,
    'updated',
    'Order',
    'orders',
    NEW.id,
    CONCAT('Order updated by user ', COALESCE(NEW.updated_by::text, 'system')),
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_update_audit ON public.orders;
CREATE TRIGGER order_update_audit
AFTER UPDATE ON public.orders
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION public.log_order_update();

