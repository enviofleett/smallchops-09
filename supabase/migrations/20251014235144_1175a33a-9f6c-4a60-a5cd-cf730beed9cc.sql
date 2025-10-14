-- Update business name from "Starters Small Chops" to "Starters"
UPDATE business_settings 
SET name = 'Starters',
    updated_at = NOW()
WHERE name = 'Starters Small Chops';

-- Verify communication settings sender name (should already be 'Starters')
-- This is just for verification, no update needed
COMMENT ON TABLE communication_settings IS 'Sender name should be Starters';