-- Update sender name to 'Starters' in communication_settings
UPDATE communication_settings 
SET sender_name = 'Starters',
    updated_at = NOW()
WHERE sender_name != 'Starters' OR sender_name IS NULL;

-- Verify the update
SELECT id, sender_name, sender_email, updated_at 
FROM communication_settings;