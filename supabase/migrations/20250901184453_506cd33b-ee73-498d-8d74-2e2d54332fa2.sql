-- Update payment integration to live mode for production readiness
UPDATE payment_integrations 
SET 
  test_mode = false,
  environment = 'live',
  connection_status = 'pending_verification',
  updated_at = NOW()
WHERE provider = 'paystack';

-- Update environment config to production
UPDATE environment_config 
SET 
  environment = 'production',
  is_live_mode = true,
  updated_at = NOW()
WHERE environment IN ('development', 'test');