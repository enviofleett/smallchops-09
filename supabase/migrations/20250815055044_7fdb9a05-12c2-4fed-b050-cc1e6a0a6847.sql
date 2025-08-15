-- Fix critical security issue: Enable RLS on the new payment_processing_logs table
ALTER TABLE payment_processing_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for payment_processing_logs table
CREATE POLICY "Service roles can manage payment processing logs" ON payment_processing_logs
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view payment processing logs" ON payment_processing_logs
FOR SELECT 
TO authenticated
USING (is_admin());