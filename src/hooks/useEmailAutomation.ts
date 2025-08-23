import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailAutomationConfig {
  orderConfirmation: boolean;
  welcomeEmail: boolean;
  orderStatusUpdates: boolean;
  adminNotifications: boolean;
  passwordReset: boolean;
  cartAbandonment: boolean;
}

interface EmailTriggerResult {
  success: boolean;
  eventId?: string;
  error?: string;
  messageId?: string;
}

export const useEmailAutomation = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // AUTOMATED EMAIL TRIGGERS FOR USER JOURNEYS

  const triggerWelcomeEmail = useCallback(async (
    customerEmail: string, 
    customerName: string,
    metadata: Record<string, any> = {}
  ): Promise<EmailTriggerResult> => {
    try {
      setIsProcessing(true);

      // Create communication event for welcome email
      const { data: eventData, error: eventError } = await supabase
        .from('communication_events')
        .insert({
          event_type: 'customer_welcome',
          recipient_email: customerEmail,
          status: 'queued',
          template_key: 'customer_welcome',
          template_variables: {
            customer_name: customerName,
            store_name: 'Starters',
            support_email: 'support@starters.com',
            ...metadata
          },
          priority: 'normal'
        })
        .select()
        .single();

      if (eventError) {
        throw new Error(`Failed to queue welcome email: ${eventError.message}`);
      }

      // Trigger immediate processing for welcome emails via SMTP
      const { data: processResult, error: processError } = await supabase.functions.invoke(
        'smtp-email-sender', 
        { body: { templateId: 'customer_welcome', recipient: { email: customerEmail, name: customerName }, variables: metadata } }
      );

      if (processError) {
        console.warn('Failed to trigger immediate processing, email will be processed in queue:', processError);
      }

      return { 
        success: true, 
        eventId: eventData.id,
        messageId: processResult?.message_id 
      };

    } catch (error: any) {
      console.error('Welcome email trigger error:', error);
      return { 
        success: false, 
        error: error.message 
      };
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const triggerOrderConfirmationEmail = useCallback(async (
    orderId: string,
    customerEmail: string,
    orderData: {
      orderNumber: string;
      customerName: string;
      totalAmount: number;
      items: any[];
      shippingAddress?: string;
    }
  ): Promise<EmailTriggerResult> => {
    try {
      setIsProcessing(true);

      // Create communication event for order confirmation
      const { data: eventData, error: eventError } = await supabase
        .from('communication_events')
        .insert({
          event_type: 'order_confirmation',
          recipient_email: customerEmail,
          order_id: orderId,
          status: 'queued',
          template_key: 'order_confirmation',
          template_variables: {
            customer_name: orderData.customerName,
            order_number: orderData.orderNumber,
            order_total: `₦${orderData.totalAmount.toLocaleString()}`,
            order_date: new Date().toLocaleDateString(),
            items_count: orderData.items.length,
            shipping_address: orderData.shippingAddress || '',
            store_name: 'Starters'
          },
          priority: 'high'
        })
        .select()
        .single();

      if (eventError) {
        throw new Error(`Failed to queue order confirmation: ${eventError.message}`);
      }

      // Also trigger admin notification
      await triggerAdminOrderNotification(orderId, orderData);

      // Trigger immediate processing for order confirmations via SMTP
      const { data: processResult, error: processError } = await supabase.functions.invoke(
        'email-queue-processor',
        { body: { action: 'process_queue', priority: 'high' } }
      );

      if (processError) {
        console.warn('Failed to trigger immediate processing:', processError);
      }

      return { 
        success: true, 
        eventId: eventData.id,
        messageId: processResult?.message_id 
      };

    } catch (error: any) {
      console.error('Order confirmation email trigger error:', error);
      return { 
        success: false, 
        error: error.message 
      };
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const triggerAdminOrderNotification = useCallback(async (
    orderId: string,
    orderData: {
      orderNumber: string;
      customerName: string;
      totalAmount: number;
      items: any[];
    }
  ): Promise<EmailTriggerResult> => {
    try {
      // Use fallback admin email since business_settings doesn't have admin_notification_email
      const adminEmail = 'store@startersmallchops.com';
      
      console.log('Using admin email for notifications:', adminEmail);

      const { data: eventData, error: eventError } = await supabase
        .from('communication_events')
        .insert({
          event_type: 'admin_new_order',
          recipient_email: adminEmail,
          order_id: orderId,
          status: 'queued',
          template_key: 'admin_new_order',
          template_variables: {
            order_number: orderData.orderNumber,
            customer_name: orderData.customerName,
            order_total: `₦${orderData.totalAmount.toLocaleString()}`,
            order_date: new Date().toLocaleDateString(),
            items_count: orderData.items.length,
            order_id: orderId
          },
          priority: 'high'
        })
        .select()
        .single();

      if (eventError) {
        throw new Error(`Failed to queue admin notification: ${eventError.message}`);
      }

      return { success: true, eventId: eventData.id };

    } catch (error: any) {
      console.error('Admin notification trigger error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const triggerOrderStatusUpdate = useCallback(async (
    orderId: string,
    customerEmail: string,
    newStatus: string,
    orderData: {
      orderNumber: string;
      customerName: string;
    }
  ): Promise<EmailTriggerResult> => {
    try {
      setIsProcessing(true);

      // Map status to template
      const statusTemplateMap: Record<string, string> = {
        'processing': 'order_processing',
        'shipped': 'order_shipped',
        'delivered': 'order_delivered',
        'cancelled': 'order_cancelled'
      };

      const templateKey = statusTemplateMap[newStatus];
      if (!templateKey) {
        return { success: false, error: `No template for status: ${newStatus}` };
      }

      const { data: eventData, error: eventError } = await supabase
        .from('communication_events')
        .insert({
          event_type: 'order_status_update',
          recipient_email: customerEmail,
          order_id: orderId,
          status: 'queued',
          template_key: templateKey,
          template_variables: {
            customer_name: orderData.customerName,
            order_number: orderData.orderNumber,
            order_status: newStatus,
            status_date: new Date().toLocaleDateString(),
            tracking_url: `https://yourdomain.com/track/${orderId}`
          },
          priority: 'normal'
        })
        .select()
        .single();

      if (eventError) {
        throw new Error(`Failed to queue status update: ${eventError.message}`);
      }

      return { success: true, eventId: eventData.id };

    } catch (error: any) {
      console.error('Order status update trigger error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const triggerPasswordResetEmail = useCallback(async (
    customerEmail: string,
    resetToken: string,
    customerName?: string
  ): Promise<EmailTriggerResult> => {
    try {
      setIsProcessing(true);

      const { data: eventData, error: eventError } = await supabase
        .from('communication_events')
        .insert({
          event_type: 'password_reset',
          recipient_email: customerEmail,
          status: 'queued',
          template_key: 'password_reset',
          template_variables: {
            customer_name: customerName || 'Customer',
            reset_link: `https://yourdomain.com/reset-password?token=${resetToken}`,
            reset_token: resetToken,
            expiry_time: '24 hours'
          },
          priority: 'high'
        })
        .select()
        .single();

      if (eventError) {
        throw new Error(`Failed to queue password reset: ${eventError.message}`);
      }

      return { success: true, eventId: eventData.id };

    } catch (error: any) {
      console.error('Password reset email trigger error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const triggerCartAbandonmentEmail = useCallback(async (
    customerEmail: string,
    customerName: string,
    cartData: {
      items: any[];
      totalValue: number;
      cartId: string;
    }
  ): Promise<EmailTriggerResult> => {
    try {
      setIsProcessing(true);

      const { data: eventData, error: eventError } = await supabase
        .from('communication_events')
        .insert({
          event_type: 'cart_abandonment',
          recipient_email: customerEmail,
          status: 'queued',
          template_key: 'cart_abandonment',
          template_variables: {
            customer_name: customerName,
            cart_total: `₦${cartData.totalValue.toLocaleString()}`,
            items_count: cartData.items.length,
            cart_recovery_link: `https://yourdomain.com/cart?recover=${cartData.cartId}`,
            first_item_name: cartData.items[0]?.name || 'items'
          },
          priority: 'low'
        })
        .select()
        .single();

      if (eventError) {
        throw new Error(`Failed to queue cart abandonment: ${eventError.message}`);
      }

      return { success: true, eventId: eventData.id };

    } catch (error: any) {
      console.error('Cart abandonment email trigger error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // EMAIL AUTOMATION MANAGEMENT
  const processEmailQueue = useCallback(async (): Promise<{
    processed: number;
    success: number;
    failed: number;
  }> => {
    try {
      const { data: result, error } = await supabase.functions.invoke('email-queue-processor', {
        body: { action: 'process_all_priorities' }
      });
      
      if (error) {
        throw new Error(`Queue processing failed: ${error.message}`);
      }

      return {
        processed: result?.total?.processed || 0,
        success: result?.total?.successful || 0,
        failed: result?.total?.failed || 0
      };

    } catch (error: any) {
      console.error('Email queue processing error:', error);
      toast({
        title: 'Queue Processing Failed',
        description: error.message,
        variant: 'destructive'
      });
      return { processed: 0, success: 0, failed: 0 };
    }
  }, [toast]);

  const getEmailQueueStatus = useCallback(async () => {
    try {
      const { data: queuedEmails, error } = await supabase
        .from('communication_events')
        .select('status, priority, event_type')
        .eq('status', 'queued');

      if (error) throw error;

      const stats = queuedEmails.reduce((acc, email) => {
        acc.total++;
        acc.byPriority[email.priority] = (acc.byPriority[email.priority] || 0) + 1;
        acc.byType[email.event_type] = (acc.byType[email.event_type] || 0) + 1;
        return acc;
      }, {
        total: 0,
        byPriority: {} as Record<string, number>,
        byType: {} as Record<string, number>
      });

      return stats;

    } catch (error: any) {
      console.error('Queue status error:', error);
      return { total: 0, byPriority: {}, byType: {} };
    }
  }, []);

  return {
    // Email triggers
    triggerWelcomeEmail,
    triggerOrderConfirmationEmail,
    triggerOrderStatusUpdate,
    triggerPasswordResetEmail,
    triggerCartAbandonmentEmail,
    
    // Queue management
    processEmailQueue,
    getEmailQueueStatus,
    
    // State
    isProcessing
  };
};