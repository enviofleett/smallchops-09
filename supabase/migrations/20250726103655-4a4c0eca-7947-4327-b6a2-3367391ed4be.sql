-- Create price history tracking table
CREATE TABLE public.product_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES auth.users(id)
);

-- Create customer notification preferences table
CREATE TABLE public.customer_notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
  price_alerts BOOLEAN NOT NULL DEFAULT true,
  promotion_alerts BOOLEAN NOT NULL DEFAULT true,
  digest_frequency TEXT NOT NULL DEFAULT 'weekly',
  minimum_discount_percentage NUMERIC NOT NULL DEFAULT 5.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id)
);

-- Create notification queue table
CREATE TABLE public.notification_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  data JSONB,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_price_history
CREATE POLICY "Admins can manage price history" 
ON public.product_price_history 
FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text]))
WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text]));

CREATE POLICY "Staff can view price history" 
ON public.product_price_history 
FOR SELECT 
USING (get_user_role(auth.uid()) = 'staff'::text);

-- RLS policies for customer_notification_preferences
CREATE POLICY "Customers can manage their own notification preferences" 
ON public.customer_notification_preferences 
FOR ALL 
USING (customer_id IN (SELECT id FROM customer_accounts WHERE user_id = auth.uid()))
WITH CHECK (customer_id IN (SELECT id FROM customer_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Staff can view all notification preferences" 
ON public.customer_notification_preferences 
FOR SELECT 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text, 'staff'::text]));

-- RLS policies for notification_queue
CREATE POLICY "Service roles can manage notification queue" 
ON public.notification_queue 
FOR ALL 
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Admins can view notification queue" 
ON public.notification_queue 
FOR SELECT 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text]));

-- Create trigger to track price changes
CREATE OR REPLACE FUNCTION public.track_price_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if price actually changed
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO public.product_price_history (product_id, old_price, new_price, changed_by)
    VALUES (NEW.id, OLD.price, NEW.price, auth.uid());
    
    -- Queue price change notifications for customers who have this product in favorites
    INSERT INTO public.notification_queue (customer_id, product_id, notification_type, data)
    SELECT 
      cf.customer_id, 
      NEW.id, 
      'price_change',
      jsonb_build_object(
        'old_price', OLD.price,
        'new_price', NEW.price,
        'product_name', NEW.name,
        'percentage_change', ROUND(((NEW.price - OLD.price) / OLD.price * 100)::numeric, 2)
      )
    FROM public.customer_favorites cf
    INNER JOIN public.customer_notification_preferences cnp ON cf.customer_id = cnp.customer_id
    WHERE cf.product_id = NEW.id 
    AND cnp.price_alerts = true
    AND ABS((NEW.price - OLD.price) / OLD.price * 100) >= cnp.minimum_discount_percentage;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for price changes
CREATE TRIGGER product_price_change_trigger
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.track_price_changes();

-- Create updated_at trigger for notification preferences
CREATE TRIGGER update_customer_notification_preferences_updated_at
  BEFORE UPDATE ON public.customer_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Create indexes for performance
CREATE INDEX idx_product_price_history_product_id ON public.product_price_history(product_id);
CREATE INDEX idx_product_price_history_changed_at ON public.product_price_history(changed_at);
CREATE INDEX idx_notification_queue_customer_id ON public.notification_queue(customer_id);
CREATE INDEX idx_notification_queue_status ON public.notification_queue(status);
CREATE INDEX idx_notification_queue_scheduled_for ON public.notification_queue(scheduled_for);