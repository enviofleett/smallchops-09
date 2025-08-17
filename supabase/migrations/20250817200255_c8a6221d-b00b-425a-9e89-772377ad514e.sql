
-- SAFELY ARCHIVE AND DELETE ALL ORDER DATA
-- This script archives current data to _archive tables and then deletes from child tables before deleting orders.
-- It is designed to be re-runnable and safe in production.

-- 1) ARCHIVE PHASE: Create archive tables (if not present) and copy data
DO $$
BEGIN
  -- Orders
  IF to_regclass('public.orders') IS NOT NULL THEN
    IF to_regclass('public.orders_archive') IS NULL THEN
      EXECUTE 'CREATE TABLE public.orders_archive (LIKE public.orders INCLUDING ALL)';
    END IF;
    EXECUTE 'INSERT INTO public.orders_archive SELECT * FROM public.orders';
  END IF;

  -- Order Items
  IF to_regclass('public.order_items') IS NOT NULL THEN
    IF to_regclass('public.order_items_archive') IS NULL THEN
      EXECUTE 'CREATE TABLE public.order_items_archive (LIKE public.order_items INCLUDING ALL)';
    END IF;
    EXECUTE 'INSERT INTO public.order_items_archive SELECT * FROM public.order_items';
  END IF;

  -- Order Status Changes
  IF to_regclass('public.order_status_changes') IS NOT NULL THEN
    IF to_regclass('public.order_status_changes_archive') IS NULL THEN
      EXECUTE 'CREATE TABLE public.order_status_changes_archive (LIKE public.order_status_changes INCLUDING ALL)';
    END IF;
    EXECUTE 'INSERT INTO public.order_status_changes_archive SELECT * FROM public.order_status_changes';
  END IF;

  -- Payment Transactions
  IF to_regclass('public.payment_transactions') IS NOT NULL THEN
    IF to_regclass('public.payment_transactions_archive') IS NULL THEN
      EXECUTE 'CREATE TABLE public.payment_transactions_archive (LIKE public.payment_transactions INCLUDING ALL)';
    END IF;
    EXECUTE 'INSERT INTO public.payment_transactions_archive SELECT * FROM public.payment_transactions';
  END IF;

  -- Communication Events
  IF to_regclass('public.communication_events') IS NOT NULL THEN
    IF to_regclass('public.communication_events_archive') IS NULL THEN
      EXECUTE 'CREATE TABLE public.communication_events_archive (LIKE public.communication_events INCLUDING ALL)';
    END IF;
    EXECUTE 'INSERT INTO public.communication_events_archive SELECT * FROM public.communication_events';
  END IF;

  -- Payment Processing Status
  IF to_regclass('public.payment_processing_status') IS NOT NULL THEN
    IF to_regclass('public.payment_processing_status_archive') IS NULL THEN
      EXECUTE 'CREATE TABLE public.payment_processing_status_archive (LIKE public.payment_processing_status INCLUDING ALL)';
    END IF;
    EXECUTE 'INSERT INTO public.payment_processing_status_archive SELECT * FROM public.payment_processing_status';
  END IF;

  -- Customer Satisfaction Ratings
  IF to_regclass('public.customer_satisfaction_ratings') IS NOT NULL THEN
    IF to_regclass('public.customer_satisfaction_ratings_archive') IS NULL THEN
      EXECUTE 'CREATE TABLE public.customer_satisfaction_ratings_archive (LIKE public.customer_satisfaction_ratings INCLUDING ALL)';
    END IF;
    EXECUTE 'INSERT INTO public.customer_satisfaction_ratings_archive SELECT * FROM public.customer_satisfaction_ratings';
  END IF;

  -- Order Assignments (if present)
  IF to_regclass('public.order_assignments') IS NOT NULL THEN
    IF to_regclass('public.order_assignments_archive') IS NULL THEN
      EXECUTE 'CREATE TABLE public.order_assignments_archive (LIKE public.order_assignments INCLUDING ALL)';
    END IF;
    EXECUTE 'INSERT INTO public.order_assignments_archive SELECT * FROM public.order_assignments';
  END IF;
END
$$;

-- 2) DELETE PHASE: Delete children first, then orders
DO $$
BEGIN
  -- Order Items
  IF to_regclass('public.order_items') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders)';
  END IF;

  -- Order Status Changes
  IF to_regclass('public.order_status_changes') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.order_status_changes WHERE order_id IN (SELECT id FROM public.orders)';
  END IF;

  -- Communication Events
  IF to_regclass('public.communication_events') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.communication_events WHERE order_id IN (SELECT id FROM public.orders)';
  END IF;

  -- Payment Transactions
  IF to_regclass('public.payment_transactions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.payment_transactions WHERE order_id IN (SELECT id FROM public.orders)';
  END IF;

  -- Payment Processing Status
  IF to_regclass('public.payment_processing_status') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.payment_processing_status WHERE order_id IN (SELECT id FROM public.orders)';
  END IF;

  -- Customer Satisfaction Ratings
  IF to_regclass('public.customer_satisfaction_ratings') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.customer_satisfaction_ratings WHERE order_id IN (SELECT id FROM public.orders)';
  END IF;

  -- Order Assignments (if present)
  IF to_regclass('public.order_assignments') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.order_assignments WHERE order_id IN (SELECT id FROM public.orders)';
  END IF;

  -- Finally, Orders
  IF to_regclass('public.orders') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.orders';
  END IF;
END
$$;

-- Optional: You can run ANALYZE to update planner stats post-deletion
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.order_status_changes;
ANALYZE public.payment_transactions;
ANALYZE public.communication_events;
ANALYZE public.payment_processing_status;
ANALYZE public.customer_satisfaction_ratings;
ANALYZE public.order_assignments;
