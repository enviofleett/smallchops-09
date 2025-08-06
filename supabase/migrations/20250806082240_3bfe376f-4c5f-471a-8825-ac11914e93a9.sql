-- RLS Performance Optimization: Wrap auth function calls in subqueries
-- This fixes auth_rls_initplan warnings by ensuring auth functions are evaluated once per query, not per row

-- admin_invitations table
ALTER POLICY "Service can manage invitations during signup" ON public.admin_invitations
USING (((SELECT auth.role()) = 'service_role'::text) OR is_admin());

-- admin_notification_preferences table  
ALTER POLICY "Admins can manage their own notification preferences" ON public.admin_notification_preferences
USING ((admin_id = (SELECT auth.uid())) AND is_admin())
WITH CHECK ((admin_id = (SELECT auth.uid())) AND is_admin());

-- admin_sessions table
ALTER POLICY "Admins can view their own sessions" ON public.admin_sessions
USING (((SELECT auth.uid()) = user_id) AND is_admin());

ALTER POLICY "System can manage admin sessions" ON public.admin_sessions
USING ((SELECT auth.role()) = 'service_role'::text);

-- api_metrics table
ALTER POLICY "Service roles can insert metrics" ON public.api_metrics
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- api_rate_limits table
ALTER POLICY "Service role can manage rate limits" ON public.api_rate_limits
USING ((SELECT auth.role()) = 'service_role'::text);

-- api_request_logs table
ALTER POLICY "Service roles can insert request logs" ON public.api_request_logs
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- audit_logs table
ALTER POLICY "Service roles can insert audit logs" ON public.audit_logs
WITH CHECK (((SELECT auth.role()) = 'service_role'::text) OR true);

-- business_analytics table
ALTER POLICY "Service roles can insert analytics" ON public.business_analytics
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- cart_abandonment_tracking table
ALTER POLICY "Service roles can manage cart abandonment tracking" ON public.cart_abandonment_tracking
USING ((SELECT auth.role()) = 'service_role'::text);

-- cart_sessions table
ALTER POLICY "Service roles can manage cart sessions" ON public.cart_sessions
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- categories table
ALTER POLICY "Authenticated users can view categories" ON public.categories
USING ((SELECT auth.role()) = 'authenticated'::text);

-- communication_events table
ALTER POLICY "Service roles can manage communication events" ON public.communication_events
USING ((SELECT auth.role()) = 'service_role'::text);

-- communication_logs table
ALTER POLICY "Service roles can insert communication logs" ON public.communication_logs
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- customer_accounts table
ALTER POLICY "Customers can insert their own account" ON public.customer_accounts
WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Customers can update their own account" ON public.customer_accounts
USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "Customers can view their own account" ON public.customer_accounts
USING ((SELECT auth.uid()) = user_id);

-- customer_addresses table
ALTER POLICY "Customers can manage their own addresses" ON public.customer_addresses
USING (customer_id IN ( SELECT customer_accounts.id
   FROM customer_accounts
  WHERE (customer_accounts.user_id = (SELECT auth.uid()))))
WITH CHECK (customer_id IN ( SELECT customer_accounts.id
   FROM customer_accounts
  WHERE (customer_accounts.user_id = (SELECT auth.uid()))));

-- customer_auth_audit table
ALTER POLICY "Service roles can manage customer auth audit" ON public.customer_auth_audit
USING ((SELECT auth.role()) = 'service_role'::text);

-- customer_communication_preferences table
ALTER POLICY "Customers can manage their own communication preferences" ON public.customer_communication_preferences
USING (customer_email IN ( SELECT users.email
   FROM auth.users
  WHERE (users.id = (SELECT auth.uid()))))
WITH CHECK (customer_email IN ( SELECT users.email
   FROM auth.users
  WHERE (users.id = (SELECT auth.uid()))));

ALTER POLICY "Service roles can manage communication preferences" ON public.customer_communication_preferences
USING ((SELECT auth.role()) = 'service_role'::text);

ALTER POLICY "Service roles can manage preferences" ON public.customer_communication_preferences
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- customer_delivery_preferences table
ALTER POLICY "Customers can manage their own delivery preferences" ON public.customer_delivery_preferences
USING (customer_id IN ( SELECT customer_accounts.id
   FROM customer_accounts
  WHERE (customer_accounts.user_id = (SELECT auth.uid()))))
WITH CHECK (customer_id IN ( SELECT customer_accounts.id
   FROM customer_accounts
  WHERE (customer_accounts.user_id = (SELECT auth.uid()))));

-- customer_favorites table
ALTER POLICY "Customers can manage their own favorites" ON public.customer_favorites
USING (customer_id IN ( SELECT customer_accounts.id
   FROM customer_accounts
  WHERE (customer_accounts.user_id = (SELECT auth.uid()))))
WITH CHECK (customer_id IN ( SELECT customer_accounts.id
   FROM customer_accounts
  WHERE (customer_accounts.user_id = (SELECT auth.uid()))));

-- customer_notification_channels table
ALTER POLICY "Customers can manage their notification channels" ON public.customer_notification_channels
USING (customer_id IN ( SELECT customer_accounts.id
   FROM customer_accounts
  WHERE (customer_accounts.user_id = (SELECT auth.uid()))));

ALTER POLICY "Service roles can manage notification channels" ON public.customer_notification_channels
USING ((SELECT auth.role()) = 'service_role'::text);

-- customer_notification_preferences table
ALTER POLICY "Customers can manage their own notification preferences" ON public.customer_notification_preferences
USING (customer_id IN ( SELECT customer_accounts.id
   FROM customer_accounts
  WHERE (customer_accounts.user_id = (SELECT auth.uid()))))
WITH CHECK (customer_id IN ( SELECT customer_accounts.id
   FROM customer_accounts
  WHERE (customer_accounts.user_id = (SELECT auth.uid()))));

-- customer_otp_codes table
ALTER POLICY "Service roles can manage customer OTP codes" ON public.customer_otp_codes
USING ((SELECT auth.role()) = 'service_role'::text);

-- customer_payment_preferences table
ALTER POLICY "Users can manage their own payment preferences" ON public.customer_payment_preferences
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- customer_rate_limits table
ALTER POLICY "Service role can manage customer rate limits" ON public.customer_rate_limits
USING ((SELECT auth.role()) = 'service_role'::text);

-- customers table
ALTER POLICY "Service role can manage customers" ON public.customers
USING ((SELECT auth.role()) = 'service_role'::text);

-- delivery_analytics table
ALTER POLICY "Service roles can manage delivery analytics" ON public.delivery_analytics
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- delivery_fees table
ALTER POLICY "Authenticated users can view delivery fees" ON public.delivery_fees
USING ((SELECT auth.role()) = 'authenticated'::text);

-- delivery_performance_metrics table
ALTER POLICY "Drivers can view their own metrics" ON public.delivery_performance_metrics
USING ((SELECT auth.uid()) = driver_id);

ALTER POLICY "Service roles can manage performance metrics" ON public.delivery_performance_metrics
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- delivery_routes table
ALTER POLICY "Authenticated users can view delivery routes" ON public.delivery_routes
USING ((SELECT auth.role()) = 'authenticated'::text);

ALTER POLICY "Service roles can manage delivery routes" ON public.delivery_routes
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- delivery_zones table
ALTER POLICY "Authenticated users can view delivery zones" ON public.delivery_zones
USING ((SELECT auth.role()) = 'authenticated'::text);

-- drivers table
ALTER POLICY "Drivers can view their own profile" ON public.drivers
USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "Drivers can update their own profile" ON public.drivers
USING ((SELECT auth.uid()) = user_id);

-- email_delivery_logs table
ALTER POLICY "Service roles can manage email delivery logs" ON public.email_delivery_logs
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- email_processing_metrics table
ALTER POLICY "Service roles can manage email processing metrics" ON public.email_processing_metrics
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- email_processing_queue table
ALTER POLICY "Service roles can manage email processing queue" ON public.email_processing_queue
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- email_rate_limits table
ALTER POLICY "Service roles can manage email rate limits" ON public.email_rate_limits
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- enhanced_rate_limits table
ALTER POLICY "Service role can manage enhanced rate limits" ON public.enhanced_rate_limits
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- hero_images table
ALTER POLICY "Users can manage hero images based on permissions" ON public.hero_images
USING (EXISTS (
    SELECT 1 FROM public.user_permissions up 
    WHERE up.user_id = (SELECT auth.uid()) 
    AND up.menu_key = 'branding' 
    AND up.permission_level IN ('edit', 'view')
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_permissions up 
    WHERE up.user_id = (SELECT auth.uid()) 
    AND up.menu_key = 'branding' 
    AND up.permission_level = 'edit'
));

-- logo_versions table
ALTER POLICY "Users can view logo versions based on permissions" ON public.logo_versions
USING (EXISTS (
    SELECT 1 FROM public.user_permissions up 
    WHERE up.user_id = (SELECT auth.uid()) 
    AND up.menu_key = 'branding' 
    AND up.permission_level IN ('edit', 'view')
));

-- loyalty_points table
ALTER POLICY "Customers can view their own loyalty points" ON public.loyalty_points
USING (customer_id IN ( SELECT customer_accounts.id
   FROM customer_accounts
  WHERE (customer_accounts.user_id = (SELECT auth.uid()))));

ALTER POLICY "Service roles can manage loyalty points" ON public.loyalty_points
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- notification_delivery_log table
ALTER POLICY "Service roles can manage notification logs" ON public.notification_delivery_log
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- order_items table
ALTER POLICY "Customers can create order items during checkout" ON public.order_items
WITH CHECK ((SELECT auth.role()) = 'authenticated'::text);

ALTER POLICY "Customers can view their own order items" ON public.order_items
USING (order_id IN ( SELECT orders.id
   FROM orders
  WHERE ((orders.customer_id IN ( SELECT customer_accounts.id
           FROM customer_accounts
          WHERE (customer_accounts.user_id = (SELECT auth.uid())))) OR (orders.customer_email IN ( SELECT users.email
           FROM auth.users
          WHERE (users.id = (SELECT auth.uid())))))));

ALTER POLICY "Service roles can manage order items" ON public.order_items
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- orders table
ALTER POLICY "Customers can view own orders by email" ON public.orders
USING ((customer_email IN ( SELECT users.email
   FROM auth.users
  WHERE (users.id = (SELECT auth.uid())))) OR (customer_id IN ( SELECT customer_accounts.id
   FROM customer_accounts
  WHERE (customer_accounts.user_id = (SELECT auth.uid())))));

ALTER POLICY "Service roles can manage orders" ON public.orders
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

ALTER POLICY "Service roles have full access" ON public.orders
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- payment_transactions table
ALTER POLICY "Service roles can manage payment transactions" ON public.payment_transactions
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- pickup_points table
ALTER POLICY "Authenticated users can view pickup points" ON public.pickup_points
USING ((SELECT auth.role()) = 'authenticated'::text);

-- product_reviews table
ALTER POLICY "Customers can create reviews for products they purchased" ON public.product_reviews
WITH CHECK (customer_purchased_product((SELECT auth.uid()), product_id));

ALTER POLICY "Customers can edit their own reviews" ON public.product_reviews
USING (customer_id = (SELECT auth.uid()));

ALTER POLICY "Customers can view their own reviews" ON public.product_reviews
USING (customer_id = (SELECT auth.uid()));

-- profiles table
ALTER POLICY "Users can update their own profile" ON public.profiles
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);

ALTER POLICY "Users can view own profile" ON public.profiles
USING ((SELECT auth.uid()) = id);

ALTER POLICY "Users can view their own profile" ON public.profiles
USING ((SELECT auth.uid()) = id);

-- promotion_customer_usage table
ALTER POLICY "Service roles can manage promotion usage" ON public.promotion_customer_usage
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- promotion_usage_tracking table
ALTER POLICY "Service roles can manage promotion tracking" ON public.promotion_usage_tracking
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- rate_limits table
ALTER POLICY "Service role can manage rate limits" ON public.rate_limits
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- refunds table
ALTER POLICY "Service roles can manage refunds" ON public.refunds
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- review_votes table
ALTER POLICY "Customers can vote on reviews" ON public.review_votes
USING ((SELECT auth.uid()) = customer_id)
WITH CHECK ((SELECT auth.uid()) = customer_id);

-- security_incidents table
ALTER POLICY "Service roles can manage security incidents" ON public.security_incidents
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- smtp_delivery_logs table
ALTER POLICY "Service roles can manage SMTP delivery logs" ON public.smtp_delivery_logs
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- upload_rate_limits table
ALTER POLICY "Users can view their own upload rate limits" ON public.upload_rate_limits
USING ((SELECT auth.uid()) = user_id);

-- user_permissions table
ALTER POLICY "Users can view their own permissions" ON public.user_permissions
USING ((SELECT auth.uid()) = user_id);

-- vehicle_assignments table
ALTER POLICY "Riders can view their own assignments" ON public.vehicle_assignments
USING ((SELECT auth.uid()) = driver_id);

ALTER POLICY "Service roles can manage vehicle assignments" ON public.vehicle_assignments
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

-- vehicles table  
ALTER POLICY "Service roles can manage vehicles" ON public.vehicles
USING ((SELECT auth.role()) = 'service_role'::text)
WITH CHECK ((SELECT auth.role()) = 'service_role'::text);