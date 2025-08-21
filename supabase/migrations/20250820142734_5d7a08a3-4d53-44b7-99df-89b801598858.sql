-- Populate webhook secret for Paystack (replace with your actual webhook secret)
INSERT INTO payment_integrations (provider, webhook_secret, is_active, created_at)
VALUES ('paystack', 'your-paystack-webhook-secret-here', true, NOW())
ON CONFLICT (provider) 
DO UPDATE SET 
  webhook_secret = EXCLUDED.webhook_secret,
  updated_at = NOW();