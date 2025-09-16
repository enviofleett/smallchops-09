
-- 1) Map legacy keys to current sidebar keys (insert only if missing)
WITH mapping(old_key, new_key) AS (
  VALUES
    ('orders','orders_view'),
    ('categories','categories_view'),
    ('products','products_view'),
    ('customers','customers_view'),
    ('promotions','promotions_view'),
    ('reports','reports-sales'),
    ('delivery','delivery_zones')
)
INSERT INTO public.user_permissions (user_id, menu_key, permission_level)
SELECT up.user_id, m.new_key, up.permission_level
FROM public.user_permissions up
JOIN mapping m ON up.menu_key = m.old_key
LEFT JOIN public.user_permissions existing 
  ON existing.user_id = up.user_id 
 AND existing.menu_key = m.new_key
WHERE existing.user_id IS NULL;

-- 2) Ensure all active admins have edit for every active menu key (idempotent)
INSERT INTO public.user_permissions (user_id, menu_key, permission_level)
SELECT p.id AS user_id, ms.key AS menu_key, 'edit'
FROM public.profiles p
JOIN public.menu_structure ms 
  ON COALESCE(ms.is_active, true) = true
LEFT JOIN public.user_permissions up 
  ON up.user_id = p.id 
 AND up.menu_key = ms.key
WHERE p.role = 'admin'
  AND COALESCE(p.is_active, true) = true
  AND up.user_id IS NULL;

-- 3) Optional: ensure a few frequently-used settings/report keys exist for admins (in case they were not in menu_structure/is_active had variance)
-- These are no-ops if they already exist.
INSERT INTO public.user_permissions (user_id, menu_key, permission_level)
SELECT p.id, 'audit_logs', 'edit'
FROM public.profiles p
LEFT JOIN public.user_permissions up 
  ON up.user_id = p.id AND up.menu_key = 'audit_logs'
WHERE p.role = 'admin' AND COALESCE(p.is_active, true) = true AND up.user_id IS NULL;

