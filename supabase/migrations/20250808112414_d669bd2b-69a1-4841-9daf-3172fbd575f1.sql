-- Clean up duplicate and overlapping email/status triggers on public.orders to ensure single, predictable email per event
-- Safe in production: only drops redundant triggers; core triggers remain

-- 1) Updated_at triggers: keep the canonical one
DROP TRIGGER IF EXISTS handle_updated_at_orders ON public.orders;

-- 2) Order emails: keep insert-only trigger, remove mixed and update duplicates
DROP TRIGGER IF EXISTS order_email_notifications ON public.orders; -- AFTER INSERT OR UPDATE calling trigger_order_emails
DROP TRIGGER IF EXISTS trigger_order_emails_update ON public.orders; -- AFTER UPDATE calling trigger_order_emails
-- Keep: trigger_order_emails_insert (AFTER INSERT)

-- 3) Status update emails: keep a single status-change trigger
DROP TRIGGER IF EXISTS order_status_change_email ON public.orders; -- duplicate calling trigger_order_status_email
-- Keep: trigger_order_status_email (AFTER UPDATE)

-- 4) Payment confirmation: keep the dedicated payment-trigger
-- Keep: trigger_order_payment_email (calls trigger_payment_confirmation_email)

-- No-op selects to verify remaining triggers exist (optional for visibility)
-- SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid = 'public.orders'::regclass;