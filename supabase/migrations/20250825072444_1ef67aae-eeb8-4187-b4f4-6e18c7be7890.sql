-- Fix order_status_changes table schema mismatch for payment processing
-- Add previous_status column if it doesn't exist and align trigger function

-- Add previous_status column to order_status_changes if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'order_status_changes' 
                   AND column_name = 'previous_status') THEN
        ALTER TABLE order_status_changes ADD COLUMN previous_status text;
        
        -- Backfill existing data
        UPDATE order_status_changes SET previous_status = old_status WHERE previous_status IS NULL;
    END IF;
END $$;

-- Add previous_status column to order_status_changes_archive if it exists and doesn't have the column
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_status_changes_archive') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'order_status_changes_archive' 
                       AND column_name = 'previous_status') THEN
            ALTER TABLE order_status_changes_archive ADD COLUMN previous_status text;
            
            -- Backfill existing archive data
            UPDATE order_status_changes_archive SET previous_status = old_status WHERE previous_status IS NULL;
        END IF;
    END IF;
END $$;

-- Update log_order_status_change function to handle both columns
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log when status actually changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO order_status_changes (
            order_id,
            old_status,
            previous_status, -- Add this for compatibility
            new_status,
            changed_by,
            changed_at,
            reason
        ) VALUES (
            NEW.id,
            OLD.status,
            OLD.status, -- Set both old_status and previous_status to the same value
            NEW.status,
            auth.uid(),
            NOW(),
            'Status updated via order modification'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS trigger_log_order_status_change ON orders;
CREATE TRIGGER trigger_log_order_status_change
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION log_order_status_change();