-- Update communication settings to enable production mode
UPDATE communication_settings 
SET production_mode = true, 
    updated_at = NOW()
WHERE id = (SELECT id FROM communication_settings ORDER BY updated_at DESC LIMIT 1);