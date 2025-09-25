-- Fix order_assignments table missing updated_at column
ALTER TABLE order_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_order_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order_assignments
DROP TRIGGER IF EXISTS trigger_update_order_assignments_updated_at ON order_assignments;
CREATE TRIGGER trigger_update_order_assignments_updated_at
    BEFORE UPDATE ON order_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_order_assignments_updated_at();