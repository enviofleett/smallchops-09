-- Create delivery_analytics table with proper structure
CREATE TABLE IF NOT EXISTS delivery_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Delivery metrics that were referenced in the failing function
    completed_deliveries INTEGER DEFAULT 0,
    total_deliveries INTEGER DEFAULT 0,
    total_delivery_fees NUMERIC(10,2) DEFAULT 0,
    pending_deliveries INTEGER DEFAULT 0,
    failed_deliveries INTEGER DEFAULT 0,
    
    -- Analytics data
    average_delivery_time_minutes INTEGER DEFAULT 0,
    total_distance_km NUMERIC(10,2) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one record per date for aggregate analytics
    UNIQUE(date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_analytics_date ON delivery_analytics(date);
CREATE INDEX IF NOT EXISTS idx_delivery_analytics_order_id ON delivery_analytics(order_id);

-- Enable RLS
ALTER TABLE delivery_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage all delivery analytics" 
ON delivery_analytics FOR ALL 
USING (is_admin());

CREATE POLICY "Service role can manage delivery analytics" 
ON delivery_analytics FOR ALL 
USING (auth.role() = 'service_role');

-- Insert initial record for today if it doesn't exist
INSERT INTO delivery_analytics (date, completed_deliveries, total_deliveries, total_delivery_fees)
VALUES (CURRENT_DATE, 0, 0, 0)
ON CONFLICT (date) DO NOTHING;