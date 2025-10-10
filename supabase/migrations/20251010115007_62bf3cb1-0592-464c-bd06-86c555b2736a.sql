-- Enable real-time for orders table (production-ready configuration)
-- This ensures floating notifications can listen to new order inserts

-- Set REPLICA IDENTITY FULL to capture complete row data
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Ensure orders table is in the realtime publication
DO $$
BEGIN
  -- Add orders table to realtime publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;

-- Log the configuration
INSERT INTO audit_logs (
  action, 
  category, 
  message, 
  new_values
) VALUES (
  'realtime_orders_configured',
  'System Configuration',
  'Orders table configured for real-time floating notifications',
  jsonb_build_object(
    'table', 'orders',
    'replica_identity', 'FULL',
    'publication', 'supabase_realtime',
    'timestamp', now()
  )
);