-- Add missing columns to existing delivery_analytics table
ALTER TABLE delivery_analytics 
ADD COLUMN IF NOT EXISTS total_delivery_fees NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_deliveries INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update any missing data
UPDATE delivery_analytics 
SET total_delivery_fees = COALESCE(total_delivery_fees, 0),
    pending_deliveries = COALESCE(pending_deliveries, 0),
    updated_at = COALESCE(updated_at, NOW())
WHERE total_delivery_fees IS NULL OR pending_deliveries IS NULL OR updated_at IS NULL;