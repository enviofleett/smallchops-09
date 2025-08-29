-- First, let's drop all existing overly permissive policies on payment_transactions
DROP POLICY IF EXISTS "Customers can create payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payment_transactions;
DROP POLICY IF EXISTS "Admins can manage all payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Admins can select all payment tx" ON public.payment_transactions;
DROP POLICY IF EXISTS "Admins can view payment_transactions" ON public.payment_transactions;

-- Create secure RLS policies for payment_transactions
-- 1. Admins can manage all transactions
CREATE POLICY "Admins can manage payment transactions"
  ON public.payment_transactions
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- 2. Service roles can manage transactions (for payment processing)
CREATE POLICY "Service roles can manage payment transactions"
  ON public.payment_transactions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Customers can only view their own payment transactions
CREATE POLICY "Customers can view own payment transactions"
  ON public.payment_transactions
  FOR SELECT
  USING (
    customer_email IS NOT NULL 
    AND customer_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- 4. Restrict payment transaction creation to service roles only (not customers directly)
CREATE POLICY "Only service roles can create payment transactions"
  ON public.payment_transactions
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Add audit logging for payment transaction access
CREATE OR REPLACE FUNCTION public.log_payment_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log access to sensitive payment data
  INSERT INTO audit_logs (
    action,
    category,
    message,
    user_id,
    entity_id,
    new_values
  ) VALUES (
    CASE 
      WHEN TG_OP = 'SELECT' THEN 'payment_transaction_viewed'
      WHEN TG_OP = 'INSERT' THEN 'payment_transaction_created'
      WHEN TG_OP = 'UPDATE' THEN 'payment_transaction_updated'
      ELSE TG_OP
    END,
    'Payment Security',
    'Payment transaction accessed: ' || COALESCE(NEW.reference, OLD.reference, 'unknown'),
    auth.uid(),
    COALESCE(NEW.id, OLD.id),
    CASE 
      WHEN NEW IS NOT NULL THEN to_jsonb(NEW)
      ELSE NULL
    END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Apply audit trigger to payment transactions
CREATE TRIGGER payment_transaction_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_payment_access();