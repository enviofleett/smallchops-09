-- ============================================================================
-- Real-Time Payment Verification Configuration
-- ============================================================================
-- This migration ensures that payment status updates are broadcast in real-time
-- to connected clients, enabling instant UI updates when payments are confirmed.

-- Enable replica identity for orders table to ensure all column data is sent in real-time updates
-- This is critical for payment confirmations to work instantly
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Ensure orders table is part of the realtime publication
-- This allows Supabase real-time subscriptions to receive instant updates
DO $$
BEGIN
  -- Check if the publication exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  
  -- Add orders table to the publication if not already added
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;

-- Enable replica identity for payment_transactions table for complete transaction tracking
ALTER TABLE public.payment_transactions REPLICA IDENTITY FULL;

-- Add payment_transactions to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'payment_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_transactions;
  END IF;
END $$;

-- Create index for faster payment verification lookups
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference 
ON public.orders(payment_reference) 
WHERE payment_status = 'pending';

-- Create index for payment transaction lookups
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference 
ON public.payment_transactions(reference);

-- Create index for real-time order updates by ID
CREATE INDEX IF NOT EXISTS idx_orders_id_payment_status 
ON public.orders(id, payment_status, status);

-- Add audit log entry for configuration
INSERT INTO public.audit_logs (
  action,
  category,
  message,
  new_values,
  created_at
) VALUES (
  'realtime_payment_verification_configured',
  'System Configuration',
  'Configured real-time payment verification with REPLICA IDENTITY FULL and realtime publication',
  jsonb_build_object(
    'tables', ARRAY['orders', 'payment_transactions'],
    'indexes_created', ARRAY[
      'idx_orders_payment_reference',
      'idx_payment_transactions_reference', 
      'idx_orders_id_payment_status'
    ],
    'replica_identity', 'FULL',
    'publication', 'supabase_realtime',
    'timestamp', now()
  ),
  now()
);