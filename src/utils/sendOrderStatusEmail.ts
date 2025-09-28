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
 * Send order status email using Gmail SMTP via edge function
 */
export async function sendOrderStatusEmail(params: SendOrderEmailParams): Promise<boolean> {
  try {
    console.log('📧 Sending order status email:', {
      to: params.to,
      status: params.status,
      orderNumber: params.orderData.order_number
    });

    // Prepare email content
    const subject = getOrderStatusSubject(params.status, params.orderData.order_number);
    const htmlContent = getOrderStatusTemplate(params.status, {
      orderData: params.orderData,
      adminEmail: params.adminEmail,
      trackingUrl: params.trackingUrl
    });
    const textContent = getOrderStatusPlainText(params.status, {
      orderData: params.orderData,
      adminEmail: params.adminEmail,
      trackingUrl: params.trackingUrl
    });

    // Send email via edge function
    const { data, error } = await supabase.functions.invoke('send-order-email', {
      body: {
        to: params.to,
        subject,
        html: htmlContent,
        text: textContent,
        orderData: {
          orderId: params.orderData.id,
          orderNumber: params.orderData.order_number,
          status: params.status
        }
      }
    });

    if (error) {
      console.error('❌ Edge function error:', error);
      throw new Error(`Email service error: ${error.message}`);
    }

    if (!data?.success) {
      console.error('❌ Email sending failed:', data);
      throw new Error(data?.error || 'Failed to send email');
    }

    console.log('✅ Order status email sent successfully:', {
      messageId: data.messageId,
      to: params.to,
      orderNumber: params.orderData.order_number
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

    // Use existing email template service
    const templateKey = `order_${params.status}`;
    const variables = {
      customer_name: params.orderData.customer_name,
      order_number: params.orderData.order_number,
      order_total: params.orderData.total_amount.toLocaleString(),
      status: params.status,
      order_type: params.orderData.order_type,
      delivery_address: params.orderData.delivery_address 
        ? (typeof params.orderData.delivery_address === 'string' 
           ? params.orderData.delivery_address 
           : params.orderData.delivery_address.address_line_1)
        : null,
      pickup_time: params.orderData.pickup_time,
      special_instructions: params.orderData.special_instructions,
      admin_email: params.adminEmail
    };

    // Queue email via communication events
    const { data, error } = await supabase
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