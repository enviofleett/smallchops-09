-- Switch to Live/Production Mode for Paystack
-- Update environment configuration to production mode
UPDATE environment_config 
SET 
  environment = 'production',
  is_live_mode = true,
  updated_at = NOW()
WHERE id IN (SELECT id FROM environment_config LIMIT 1);

-- If no environment config exists, create one in production mode
INSERT INTO environment_config (
  environment, 
  is_live_mode, 
  created_at, 
  updated_at
)
SELECT 
  'production',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM environment_config);

-- Update payment integrations to use live mode
UPDATE payment_integrations 
SET 
  test_mode = false,
  environment = 'live',
  updated_at = NOW()
WHERE provider = 'paystack';

-- Log the switch to production
INSERT INTO audit_logs (
  action,
  category,
  message,
  user_id,
  new_values,
  event_time
) VALUES (
  'environment_switched_to_production',
  'System Configuration',
  'Environment switched from test to production/live mode',
  auth.uid(),
  jsonb_build_object(
    'previous_mode', 'test',
    'new_mode', 'production',
    'timestamp', NOW(),
    'force_live_mode', true
  ),
  NOW()
);