-- Update Paystack configuration with environment variables
UPDATE paystack_secure_config 
SET 
  test_secret_key = CASE WHEN test_mode = true THEN 'env:PAYSTACK_SECRET_KEY' ELSE test_secret_key END,
  live_secret_key = CASE WHEN test_mode = false THEN 'env:PAYSTACK_SECRET_KEY' ELSE live_secret_key END,
  test_public_key = CASE WHEN test_mode = true THEN 'env:PAYSTACK_PUBLIC_KEY' ELSE test_public_key END,
  live_public_key = CASE WHEN test_mode = false THEN 'env:PAYSTACK_PUBLIC_KEY' ELSE live_public_key END,
  updated_at = NOW()
WHERE is_active = true;

-- If no active config exists, create one for test mode
INSERT INTO paystack_secure_config (
  test_mode,
  test_secret_key,
  test_public_key,
  is_active,
  created_at,
  updated_at
)
SELECT 
  true,
  'env:PAYSTACK_SECRET_KEY',
  'env:PAYSTACK_PUBLIC_KEY',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM paystack_secure_config WHERE is_active = true);