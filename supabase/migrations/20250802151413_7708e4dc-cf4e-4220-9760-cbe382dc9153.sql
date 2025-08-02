-- Fix communication_events table schema first
-- Add missing priority column
ALTER TABLE communication_events 
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- Update all existing records to have 'normal' priority
UPDATE communication_events SET priority = 'normal' WHERE priority IS NULL;