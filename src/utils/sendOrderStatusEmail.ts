import { supabase } from '@/integrations/supabase/client';
import { OrderStatus } from '@/types/orderDetailsModal';
import { getOrderStatusTemplate, getOrderStatusSubject, getOrderStatusPlainText, OrderData } from '@/emailTemplates/orderStatusTemplates';

export interface SendOrderEmailParams {
  to: string;
  orderData: OrderData;
  status: OrderStatus;
  adminEmail: string;
  trackingUrl?: string;
}

/**
 * Send order status email using the queue-first approach for reliability
 * This inserts into communication_events and then triggers the processor
 */
export async function sendOrderStatusEmail(params: SendOrderEmailParams): Promise<boolean> {
  try {
    console.log('📧 Queuing order status email:', {
      to: params.to,
      status: params.status,
      orderNumber: params.orderData.order_number
    });

    // Fetch business settings for comprehensive variables
    const { data: businessSettings } = await (supabase as any)
      .from('business_settings')
      .select('admin_notification_email, name, site_url')
      .single();

    const supportEmail = businessSettings?.admin_notification_email || params.adminEmail || 'support@startersmallchops.com';
    const businessName = businessSettings?.name || 'Starters';
    const websiteUrl = businessSettings?.site_url || window.location.origin;

    const statusDisplayMap: Record<string, string> = {
      'confirmed': 'Confirmed',
      'preparing': 'Being Prepared',
      'ready': 'Ready for Pickup',
      'out_for_delivery': 'Out for Delivery',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled'
    };

    // Use mapped template keys to match backend configuration
    const templateKeyMap: Record<string, string> = {
      'confirmed': 'order_confirmed',
      'preparing': 'order_preparing',
      'ready': 'order_ready',
      'out_for_delivery': 'order_out_for_delivery',
      'delivered': 'order_delivered',
      'cancelled': 'order_cancelled'
    };

    const templateKey = templateKeyMap[params.status] || `order_${params.status}`;

    const variables = {
      customer_name: params.orderData.customer_name || 'Customer',
      order_number: params.orderData.order_number,
      status_display: statusDisplayMap[params.status] || params.status,
      new_status: params.status,
      status_date: new Date().toLocaleString('en-US', { 
        dateStyle: 'full', 
        timeStyle: 'short' 
      }),
      support_email: supportEmail,
      order_total: `₦${params.orderData.total_amount.toLocaleString()}`,
      total_amount: params.orderData.total_amount.toLocaleString(),
      business_name: businessName,
      website_url: websiteUrl,
      order_type: params.orderData.order_type,
      delivery_address: params.orderData.delivery_address 
        ? (typeof params.orderData.delivery_address === 'string' 
           ? params.orderData.delivery_address 
           : params.orderData.delivery_address.address_line_1)
        : '',
      pickup_point: params.orderData.order_type === 'pickup' ? 'Main Location' : '',
      pickup_time: params.orderData.pickup_time,
      special_instructions: params.orderData.special_instructions || '',
      tracking_url: params.trackingUrl || '',
      current_year: new Date().getFullYear().toString(),
      admin_email: supportEmail
    };

    // Queue email via communication events
    const { data, error } = await (supabase as any)
      .from('communication_events')
      .insert({
        event_type: 'order_status_update',
        recipient_email: params.to,
        template_key: templateKey,
        template_variables: variables,
        status: 'queued',
        order_id: params.orderData.id,
        priority: 'high', // High priority for status updates
        email_type: 'transactional'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to queue email via communication events:', error);
      throw new Error(`Failed to queue email: ${error.message}`);
    }

    console.log('✅ Order status email queued successfully:', {
      eventId: data.id,
      to: params.to,
      orderNumber: params.orderData.order_number
    });

    // Attempt instant delivery by triggering the processor
    // We don't await this or fail if it errors, as the background worker will pick it up
    supabase.functions.invoke('unified-email-queue-processor')
      .then(({ error }) => {
        if (error) console.warn('⚠️ Instant processing trigger failed (background worker will handle it):', error);
        else console.log('🚀 Instant processing triggered successfully');
      });

    return true;
  } catch (error: any) {
    console.error('💥 Error sending order status email:', error);
    throw error;
  }
}

/**
 * Send order status email using existing communication events system (fallback)
 */
export async function sendOrderStatusEmailFallback(params: SendOrderEmailParams): Promise<boolean> {
  try {
    console.log('📧 Sending order status email via communication events (fallback):', {
      to: params.to,
      status: params.status,
      orderNumber: params.orderData.order_number
    });

    // Fetch business settings for comprehensive variables
    const { data: businessSettings } = await (supabase as any)
      .from('business_settings')
      .select('admin_notification_email, name, site_url')
      .single();

    const supportEmail = businessSettings?.admin_notification_email || params.adminEmail || 'support@startersmallchops.com';
    const businessName = businessSettings?.name || 'Starters';
    const websiteUrl = businessSettings?.site_url || window.location.origin;

    const statusDisplayMap: Record<string, string> = {
      'confirmed': 'Confirmed',
      'preparing': 'Being Prepared',
      'ready': 'Ready for Pickup',
      'out_for_delivery': 'Out for Delivery',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled'
    };

    // Use mapped template keys to match backend configuration
    const templateKeyMap: Record<string, string> = {
      'confirmed': 'order_confirmed',
      'preparing': 'order_preparing',
      'ready': 'order_ready',
      'out_for_delivery': 'order_out_for_delivery',
      'delivered': 'order_delivered',
      'cancelled': 'order_cancelled'
    };

    // Use existing email template service
    const templateKey = templateKeyMap[params.status] || `order_${params.status}`;
    const variables = {
      customer_name: params.orderData.customer_name || 'Customer',
      order_number: params.orderData.order_number,
      status_display: statusDisplayMap[params.status] || params.status,
      new_status: params.status,
      status_date: new Date().toLocaleString('en-US', { 
        dateStyle: 'full', 
        timeStyle: 'short' 
      }),
      support_email: supportEmail,
      order_total: `₦${params.orderData.total_amount.toLocaleString()}`,
      total_amount: params.orderData.total_amount.toLocaleString(),
      business_name: businessName,
      website_url: websiteUrl,
      order_type: params.orderData.order_type,
      delivery_address: params.orderData.delivery_address 
        ? (typeof params.orderData.delivery_address === 'string' 
           ? params.orderData.delivery_address 
           : params.orderData.delivery_address.address_line_1)
        : '',
      pickup_point: params.orderData.order_type === 'pickup' ? 'Main Location' : '',
      pickup_time: params.orderData.pickup_time,
      special_instructions: params.orderData.special_instructions || '',
      tracking_url: params.trackingUrl || '',
      current_year: new Date().getFullYear().toString(),
      admin_email: supportEmail
    };

    // Queue email via communication events
    const { data, error } = await (supabase as any)
      .from('communication_events')
      .insert({
        event_type: 'order_status_update',
        recipient_email: params.to,
        template_key: templateKey,
        template_variables: variables,
        status: 'queued',
        order_id: params.orderData.id,
        priority: 'normal',
        email_type: 'transactional'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to queue email via communication events:', error);
      throw new Error(`Failed to queue email: ${error.message}`);
    }

    console.log('✅ Order status email queued successfully via communication events:', {
      eventId: data.id,
      to: params.to,
      orderNumber: params.orderData.order_number
    });

    return true;
  } catch (error: any) {
    console.error('💥 Error sending order status email via fallback:', error);
    throw error;
  }
}

/**
 * Send order status email with automatic fallback
 */
export async function sendOrderStatusEmailWithFallback(params: SendOrderEmailParams): Promise<boolean> {
  try {
    // Try primary method first
    return await sendOrderStatusEmail(params);
  } catch (primaryError) {
    console.warn('⚠️ Primary email method failed, trying fallback:', primaryError);
    
    try {
      // Try fallback method
      return await sendOrderStatusEmailFallback(params);
    } catch (fallbackError) {
      console.error('💥 Both email methods failed:', {
        primaryError: primaryError.message,
        fallbackError: fallbackError.message
      });
      throw new Error(`Email delivery failed: ${fallbackError.message}`);
    }
  }
}