-- Phase 2: Core Functionality - Fix remaining function security and RLS policies

-- 1. Fix remaining database functions with proper security settings
CREATE OR REPLACE FUNCTION public.has_email_consent(email_address text, consent_type text DEFAULT 'marketing'::text)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.email_consents 
    WHERE email_address = $1 
    AND consent_type = $2 
    AND is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_send_email_to(email_address text, email_type text DEFAULT 'transactional'::text)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.email_unsubscribes 
    WHERE email_unsubscribes.email_address = can_send_email_to.email_address
    AND (
      unsubscribe_type = 'all' 
      OR (email_type = 'marketing' AND unsubscribe_type = 'marketing')
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  order_count INTEGER;
  order_number TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO order_count FROM public.orders;
  order_number := 'ORD' || LPAD(order_count::TEXT, 6, '0');
  RETURN order_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.customer_purchased_product(customer_uuid uuid, product_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.orders o
    JOIN public.order_items oi ON o.id = oi.order_id
    JOIN public.customer_accounts ca ON o.customer_email = ca.name OR o.customer_email = ca.phone
    WHERE ca.id = customer_uuid 
    AND oi.product_id = product_uuid 
    AND o.status = 'completed'
  );
END;
$function$;

-- 2. Add RLS policies for remaining customer-facing tables

-- Categories table - Allow public read access
CREATE POLICY "Public can view categories" 
ON public.categories 
FOR SELECT 
USING (true);

-- Business settings - Public read for basic info, admin write
CREATE POLICY "Public can view basic business settings" 
ON public.business_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage business settings" 
ON public.business_settings 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

-- Customer favorites - Customer-specific access
CREATE POLICY "Customers can view their own favorites" 
ON public.customer_favorites 
FOR SELECT 
USING (
  customer_id IN (
    SELECT id FROM customer_accounts WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Customers can delete their own favorites" 
ON public.customer_favorites 
FOR DELETE 
USING (
  customer_id IN (
    SELECT id FROM customer_accounts WHERE user_id = auth.uid()
  )
);

-- Customer delivery preferences - Customer-specific access
CREATE POLICY "Customers can insert their own delivery preferences" 
ON public.customer_delivery_preferences 
FOR INSERT 
WITH CHECK (
  customer_id IN (
    SELECT id FROM customer_accounts WHERE user_id = auth.uid()
  )
);

-- Customer notification preferences - Customer-specific access  
CREATE POLICY "Customers can insert their own notification preferences" 
ON public.customer_notification_preferences 
FOR INSERT 
WITH CHECK (
  customer_id IN (
    SELECT id FROM customer_accounts WHERE user_id = auth.uid()
  )
);

-- Customer preferences - Customer-specific access
CREATE POLICY "Customers can insert their own preferences" 
ON public.customer_preferences 
FOR INSERT 
WITH CHECK (
  customer_id IN (
    SELECT id FROM customer_accounts WHERE user_id = auth.uid()
  )
);

-- Products table - Public read access for shopping
CREATE POLICY "Public can view products" 
ON public.products 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage products" 
ON public.products 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

-- Content management - Public read for published content
CREATE POLICY "Service roles can manage content" 
ON public.content_management 
FOR ALL 
USING (auth.role() = 'service_role');

-- 3. Create order processing functions for checkout flow
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_customer_email text,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address jsonb,
  p_order_items jsonb,
  p_total_amount numeric,
  p_delivery_fee numeric DEFAULT 0,
  p_delivery_zone_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_result jsonb;
BEGIN
  -- Generate order number
  v_order_number := generate_order_number();
  
  -- Create order
  INSERT INTO public.orders (
    order_number,
    customer_email,
    customer_name,
    customer_phone,
    delivery_address,
    total_amount,
    delivery_fee,
    delivery_zone_id,
    status,
    payment_status
  ) VALUES (
    v_order_number,
    p_customer_email,
    p_customer_name,
    p_customer_phone,
    p_delivery_address,
    p_total_amount,
    p_delivery_fee,
    p_delivery_zone_id,
    'pending',
    'pending'
  ) RETURNING id INTO v_order_id;
  
  -- Insert order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_id,
      quantity,
      unit_price,
      total_price
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'total_price')::numeric
    );
  END LOOP;
  
  -- Queue communication event for order confirmation
  INSERT INTO public.communication_events (
    event_type,
    recipient_email,
    payload,
    status
  ) VALUES (
    'order_confirmation',
    p_customer_email,
    jsonb_build_object(
      'order_id', v_order_id,
      'order_number', v_order_number,
      'customer_name', p_customer_name,
      'total_amount', p_total_amount
    ),
    'queued'
  );
  
  v_result := jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'message', 'Order created successfully'
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to create order'
    );
END;
$function$;

-- 4. Update order status function with proper error handling
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status text,
  p_payment_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_status text;
  v_order_exists boolean;
  v_result jsonb;
BEGIN
  -- Check if order exists and get current status
  SELECT status INTO v_old_status 
  FROM public.orders 
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found',
      'message', 'Order with the specified ID does not exist'
    );
  END IF;
  
  -- Update order status
  UPDATE public.orders 
  SET 
    status = p_new_status,
    payment_status = CASE 
      WHEN p_new_status IN ('confirmed', 'processing', 'completed') THEN 'paid'
      WHEN p_new_status = 'cancelled' THEN 'refunded'
      ELSE payment_status
    END,
    provider_reference = COALESCE(p_payment_reference, provider_reference),
    updated_at = NOW()
  WHERE id = p_order_id;
  
  -- Queue status update communication
  INSERT INTO public.communication_events (
    event_type,
    order_id,
    payload,
    status
  ) VALUES (
    'order_status_update',
    p_order_id,
    jsonb_build_object(
      'old_status', v_old_status,
      'new_status', p_new_status,
      'order_id', p_order_id
    ),
    'queued'
  );
  
  v_result := jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'old_status', v_old_status,
    'new_status', p_new_status,
    'message', 'Order status updated successfully'
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to update order status'
    );
END;
$function$;