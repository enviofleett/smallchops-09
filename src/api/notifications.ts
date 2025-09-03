import { supabase } from '@/integrations/supabase/client';

export interface NotificationTemplate {
  id?: string;
  template_key: string;
  template_name: string;
  channel: 'sms' | 'email' | 'both';
  subject?: string;
  content: string;
  variables?: string[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationDeliveryLog {
  id?: string;
  order_id?: string;
  customer_id?: string;
  template_id?: string;
  channel: 'sms' | 'email';
  recipient: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  provider_response?: any;
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  error_message?: string;
  created_at?: string;
}

export interface NotificationRequest {
  template_key: string;
  recipient: string;
  channel: 'sms' | 'email' | 'both';
  variables?: Record<string, string>;
  order_id?: string;
  customer_id?: string;
}

// Notification Templates API
export const getNotificationTemplates = async (): Promise<NotificationTemplate[]> => {
  const { data, error } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('is_active', true)
    .order('template_name');

  if (error) throw error;
  return (data || []) as any;
};

export const getNotificationTemplate = async (templateKey: string): Promise<NotificationTemplate | null> => {
  const { data, error } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data as any;
};

export const createNotificationTemplate = async (template: Omit<NotificationTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<NotificationTemplate> => {
  const { data, error } = await supabase
    .from('notification_templates')
    .insert(template)
    .select()
    .single();

  if (error) throw error;
  return data as any;
};

export const updateNotificationTemplate = async (id: string, updates: Partial<NotificationTemplate>): Promise<NotificationTemplate> => {
  const { data, error } = await supabase
    .from('notification_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as any;
};

// Notification Delivery API
export const getNotificationLogs = async (filters?: {
  orderId?: string;
  customerId?: string;
  status?: string;
  channel?: string;
  limit?: number;
}): Promise<NotificationDeliveryLog[]> => {
  let query = supabase
    .from('notification_delivery_log')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.orderId) {
    query = query.eq('order_id', filters.orderId);
  }

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.channel) {
    query = query.eq('channel', filters.channel);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as any;
};

// Send Notification Function
export const sendNotification = async (request: NotificationRequest): Promise<{ success: boolean; message: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-delivery-notification', {
      body: request
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('Failed to send notification:', error);
    throw new Error(error.message || 'Failed to send notification');
  }
};

// Bulk send notifications for order status changes
export const sendOrderStatusNotification = async (
  orderId: string,
  newStatus: string,
  customerEmail: string,
  customerPhone?: string,
  orderData?: Record<string, any>
): Promise<{ success: boolean; emailSent: boolean; smsSent: boolean; message: string }> => {
  // Map order status to notification template
  // Status-to-template mapping using existing template keys
  const templateKeyMap: Record<string, string> = {
    'confirmed': 'order_confirmation',
    'preparing': 'order_processing',
    'ready': 'order_ready',
    'out_for_delivery': 'out_for_delivery',
    'delivered': 'order_completed',
    'completed': 'order_completed',
    'cancelled': 'order_canceled',
    'paid': 'payment_confirmation'
  };

  const templateKey = templateKeyMap[newStatus];
  if (!templateKey) {
    throw new Error(`No notification template for status: ${newStatus}`);
  }

  let emailSent = false;
  let smsSent = false;
  const errors: string[] = [];

  // Send email notification
  try {
    const emailResult = await sendNotification({
      template_key: templateKey,
      recipient: customerEmail,
      channel: 'email',
      variables: orderData,
      order_id: orderId
    });
    emailSent = emailResult.success;
    if (!emailResult.success) {
      errors.push(`Email: ${emailResult.message}`);
    }
  } catch (error: any) {
    errors.push(`Email: ${error.message}`);
  }

  // Send SMS notification if phone number is available
  if (customerPhone) {
    try {
      const smsResult = await sendNotification({
        template_key: templateKey,
        recipient: customerPhone,
        channel: 'sms',
        variables: orderData,
        order_id: orderId
      });
      smsSent = smsResult.success;
      if (!smsResult.success) {
        errors.push(`SMS: ${smsResult.message}`);
      }
    } catch (error: any) {
      errors.push(`SMS: ${error.message}`);
    }
  } else {
    smsSent = true; // Consider SMS as successful if not attempted
  }

  const overallSuccess = emailSent && smsSent;
  
  return {
    success: overallSuccess,
    emailSent,
    smsSent,
    message: errors.length > 0 ? errors.join(', ') : 'Notifications sent successfully'
  };
};

// Template variable replacement utility
export const replaceTemplateVariables = (template: string, variables: Record<string, string>): string => {
  let result = template;
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    result = result.replace(regex, value || '');
  });
  
  return result;
};