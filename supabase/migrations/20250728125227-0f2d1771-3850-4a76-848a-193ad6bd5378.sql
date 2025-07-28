-- Create comprehensive email template configuration
UPDATE communication_settings 
SET email_templates = '{
  "order_confirmation": {
    "template_id": "order_confirmation",
    "subject": "Order Confirmation - {{orderNumber}}",
    "variables": ["customerName", "orderNumber", "orderTotal", "orderItems", "deliveryAddress", "estimatedDelivery"]
  },
  "order_preparing": {
    "template_id": "order_preparing", 
    "subject": "Your Order is Being Prepared - {{orderNumber}}",
    "variables": ["customerName", "orderNumber", "estimatedReady"]
  },
  "order_ready": {
    "template_id": "order_ready",
    "subject": "Order Ready for {{orderType}} - {{orderNumber}}", 
    "variables": ["customerName", "orderNumber", "orderType", "pickupAddress", "readyTime"]
  },
  "order_out_for_delivery": {
    "template_id": "order_out_for_delivery",
    "subject": "Your Order is Out for Delivery - {{orderNumber}}",
    "variables": ["customerName", "orderNumber", "estimatedDelivery", "trackingUrl", "riderInfo"]
  },
  "order_delivered": {
    "template_id": "order_delivered", 
    "subject": "Order Delivered Successfully - {{orderNumber}}",
    "variables": ["customerName", "orderNumber", "deliveryTime", "reviewUrl"]
  },
  "order_completed": {
    "template_id": "order_completed",
    "subject": "Thank You for Your Order - {{orderNumber}}",
    "variables": ["customerName", "orderNumber", "reviewUrl", "loyaltyPoints"]
  },
  "order_cancelled": {
    "template_id": "order_cancelled",
    "subject": "Order Cancellation - {{orderNumber}}", 
    "variables": ["customerName", "orderNumber", "cancellationReason", "refundInfo"]
  },
  "price_change_alert": {
    "template_id": "price_change_alert",
    "subject": "Price Alert: {{productName}}",
    "variables": ["customerName", "productName", "oldPrice", "newPrice", "percentageChange", "productUrl"]
  },
  "promotion_alert": {
    "template_id": "promotion_alert", 
    "subject": "Special Offer: {{promotionTitle}}",
    "variables": ["customerName", "promotionTitle", "discountPercentage", "validUntil", "promoCode", "shopUrl"]
  },
  "welcome": {
    "template_id": "welcome",
    "subject": "Welcome to {{companyName}}!",
    "variables": ["customerName", "companyName", "welcomeMessage", "shopUrl", "supportEmail"]
  }
}'::jsonb,
triggers = '{
  "order_status_changes": {
    "confirmed": "order_confirmation",
    "preparing": "order_preparing", 
    "ready_for_pickup": "order_ready",
    "ready_for_delivery": "order_ready",
    "out_for_delivery": "order_out_for_delivery", 
    "delivered": "order_delivered",
    "completed": "order_completed",
    "cancelled": "order_cancelled"
  },
  "price_changes": {
    "enabled": true,
    "minimum_percentage": 5.0,
    "template": "price_change_alert"
  },
  "promotions": {
    "enabled": true,
    "template": "promotion_alert" 
  },
  "welcome_emails": {
    "enabled": true,
    "template": "welcome"
  }
}'::jsonb
WHERE id = (SELECT id FROM communication_settings LIMIT 1);

-- Add indexes for email performance optimization
CREATE INDEX IF NOT EXISTS idx_communication_events_recipient_email ON communication_events(recipient_email);
CREATE INDEX IF NOT EXISTS idx_communication_events_status ON communication_events(status);
CREATE INDEX IF NOT EXISTS idx_communication_events_created_at ON communication_events(created_at);
CREATE INDEX IF NOT EXISTS idx_communication_events_email_type ON communication_events(email_type);
CREATE INDEX IF NOT EXISTS idx_communication_events_sent_at ON communication_events(sent_at);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_recipient ON email_delivery_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_timestamp ON email_delivery_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status ON email_delivery_logs(status);

CREATE INDEX IF NOT EXISTS idx_email_consents_email_active ON email_consents(email_address, is_active);
CREATE INDEX IF NOT EXISTS idx_email_suppression_email ON email_suppression_list(email_address);

-- Add cleanup function for old communication events
CREATE OR REPLACE FUNCTION cleanup_old_communication_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete events older than 90 days, except failed ones (keep for analysis)
  DELETE FROM communication_events 
  WHERE created_at < NOW() - INTERVAL '90 days' 
  AND status != 'failed';
  
  -- Delete very old failed events (older than 1 year)
  DELETE FROM communication_events 
  WHERE created_at < NOW() - INTERVAL '1 year' 
  AND status = 'failed';
  
  -- Clean up old email delivery logs (older than 6 months)
  DELETE FROM email_delivery_logs 
  WHERE created_at < NOW() - INTERVAL '6 months';
  
  -- Log cleanup operation
  INSERT INTO audit_logs (action, category, message) 
  VALUES ('cleanup_communication_data', 'System Maintenance', 'Cleaned up old communication events and delivery logs');
END;
$$;

-- Add enhanced monitoring function for email health
CREATE OR REPLACE FUNCTION get_hourly_email_stats(start_time timestamp with time zone, end_time timestamp with time zone)
RETURNS TABLE(
  hour_bucket timestamp with time zone,
  total_sent integer,
  successful_delivered integer,
  failed_attempts integer,
  bounce_rate numeric,
  delivery_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    date_trunc('hour', ce.sent_at) as hour_bucket,
    COUNT(*)::integer as total_sent,
    COUNT(*) FILTER (WHERE edl.status = 'delivered')::integer as successful_delivered,
    COUNT(*) FILTER (WHERE ce.status = 'failed' OR edl.status IN ('bounced', 'complained'))::integer as failed_attempts,
    ROUND(
      (COUNT(*) FILTER (WHERE edl.status IN ('bounced', 'complained'))::numeric / NULLIF(COUNT(*), 0)) * 100, 
      2
    ) as bounce_rate,
    ROUND(
      (COUNT(*) FILTER (WHERE edl.status = 'delivered')::numeric / NULLIF(COUNT(*), 0)) * 100, 
      2
    ) as delivery_rate
  FROM communication_events ce
  LEFT JOIN email_delivery_logs edl ON ce.external_id = edl.email_id
  WHERE ce.sent_at BETWEEN start_time AND end_time
  AND ce.status != 'queued'
  GROUP BY date_trunc('hour', ce.sent_at)
  ORDER BY hour_bucket;
END;
$$;