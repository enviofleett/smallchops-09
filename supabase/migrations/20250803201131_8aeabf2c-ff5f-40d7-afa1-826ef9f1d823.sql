-- Allow public read access to business settings for website display
CREATE POLICY "Public can view business settings" 
ON public.business_settings 
FOR SELECT 
USING (true);