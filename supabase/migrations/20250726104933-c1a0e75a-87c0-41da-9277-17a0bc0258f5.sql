-- Create payment transactions table for detailed transaction logging
CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('charge', 'refund', 'partial_refund')),
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'NGN',
  payment_method TEXT,
  provider_transaction_id TEXT,
  provider_response JSONB,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create customer purchase analytics table
CREATE TABLE public.customer_purchase_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID,
  customer_email TEXT NOT NULL,
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  average_order_value NUMERIC DEFAULT 0,
  favorite_category_id UUID REFERENCES public.categories(id),
  last_purchase_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_email)
);

-- Enable RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_purchase_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_transactions
CREATE POLICY "Customers can view their own transactions" 
ON public.payment_transactions 
FOR SELECT 
USING (
  order_id IN (
    SELECT id FROM public.orders 
    WHERE customer_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Staff can view all transactions" 
ON public.payment_transactions 
FOR SELECT 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text]));

CREATE POLICY "Service roles can manage transactions" 
ON public.payment_transactions 
FOR ALL 
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- RLS policies for customer_purchase_analytics
CREATE POLICY "Customers can view their own analytics" 
ON public.customer_purchase_analytics 
FOR SELECT 
USING (
  customer_email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
);

CREATE POLICY "Staff can view all analytics" 
ON public.customer_purchase_analytics 
FOR SELECT 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text]));

CREATE POLICY "Service roles can manage analytics" 
ON public.customer_purchase_analytics 
FOR ALL 
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Create function to update customer analytics
CREATE OR REPLACE FUNCTION public.update_customer_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert customer analytics when order status changes to completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO public.customer_purchase_analytics (
      customer_email,
      total_orders,
      total_spent,
      average_order_value,
      last_purchase_date
    )
    SELECT 
      NEW.customer_email,
      COUNT(*),
      SUM(total_amount),
      AVG(total_amount),
      MAX(order_time)
    FROM public.orders 
    WHERE customer_email = NEW.customer_email 
    AND status = 'completed'
    ON CONFLICT (customer_email) 
    DO UPDATE SET
      total_orders = EXCLUDED.total_orders,
      total_spent = EXCLUDED.total_spent,
      average_order_value = EXCLUDED.average_order_value,
      last_purchase_date = EXCLUDED.last_purchase_date,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update analytics on order completion
CREATE TRIGGER update_customer_analytics_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_analytics();

-- Create indexes for performance
CREATE INDEX idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX idx_customer_analytics_email ON public.customer_purchase_analytics(customer_email);

-- Add updated_at trigger for payment_transactions
CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();