-- Initialize default environment configuration if not exists
INSERT INTO public.environment_config (environment, is_live_mode, webhook_url)
SELECT 'development', false, 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/paystack-webhook-secure'
WHERE NOT EXISTS (SELECT 1 FROM public.environment_config);

-- Update production checklist with more specific items for current implementation
UPDATE public.production_checklist 
SET item_description = 'Configure live Paystack API keys in payment settings. Test keys are for development only.'
WHERE item_name = 'Configure Live Paystack Keys';

UPDATE public.production_checklist 
SET item_description = 'Webhook function now validates against updated Paystack IP addresses automatically'
WHERE item_name = 'Update Webhook IP Whitelist';

-- Add completion status for items that are already implemented
UPDATE public.production_checklist 
SET is_completed = true, completed_at = NOW()
WHERE item_name IN (
  'Update Webhook IP Whitelist',
  'Configure Error Handling'
) AND is_completed = false;