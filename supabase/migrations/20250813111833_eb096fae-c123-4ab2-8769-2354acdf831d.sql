-- Add WhatsApp support number to business settings
ALTER TABLE public.business_settings 
ADD COLUMN whatsapp_support_number TEXT;