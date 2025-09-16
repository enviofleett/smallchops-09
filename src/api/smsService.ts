import { supabase } from '@/integrations/supabase/client';

export interface SMSTemplate {
  id: string;
  template_key: string;
  template_name: string;
  content: string;
  variables: string[];
  category: string;
  is_active: boolean;
  max_length: number;
  created_at: string;
  updated_at: string;
}

export interface SMSConfiguration {
  id: string;
  provider: string;
  sender_id: string;
  is_active: boolean;
  rate_limit_per_minute: number;
  cost_per_sms: number;
  balance_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface SendSMSRequest {
  to: string;
  template_key: string;
  variables?: Record<string, string>;
  priority?: 'low' | 'normal' | 'high';
  order_id?: string;
}

export interface SendSMSResponse {
  success: boolean;
  message: string;
  provider_response?: any;
  cost?: number;
  error?: string;
}

class SMSService {
  // SMS Templates Management
  async getTemplates(): Promise<SMSTemplate[]> {
    const { data, error } = await supabase
      .from('sms_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform the data to handle Json type for variables
    return (data || []).map(template => ({
      ...template,
      variables: Array.isArray(template.variables) ? template.variables : 
                typeof template.variables === 'string' ? 
                  JSON.parse(template.variables) : []
    }));
  }

  async getTemplate(templateKey: string): Promise<SMSTemplate | null> {
    const { data, error } = await supabase
      .from('sms_templates')
      .select('*')
      .eq('template_key', templateKey)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return {
      ...data,
      variables: Array.isArray(data.variables) ? data.variables : 
                typeof data.variables === 'string' ? 
                  JSON.parse(data.variables) : []
    };
  }

  async createTemplate(template: Omit<SMSTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<SMSTemplate> {
    const { data, error } = await supabase
      .from('sms_templates')
      .insert([template])
      .select()
      .single();

    if (error) throw error;

    return {
      ...data,
      variables: Array.isArray(data.variables) ? data.variables : 
                typeof data.variables === 'string' ? 
                  JSON.parse(data.variables) : []
    };
  }

  async updateTemplate(id: string, updates: Partial<SMSTemplate>): Promise<SMSTemplate> {
    const { data, error } = await supabase
      .from('sms_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      ...data,
      variables: Array.isArray(data.variables) ? data.variables : 
                typeof data.variables === 'string' ? 
                  JSON.parse(data.variables) : []
    };
  }

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase
      .from('sms_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // SMS Configuration Management
  async getConfiguration(): Promise<SMSConfiguration | null> {
    const { data, error } = await supabase
      .from('sms_configuration')
      .select('*')
      .eq('provider', 'mysmstab')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  }

  async updateConfiguration(id: string, updates: Partial<SMSConfiguration>): Promise<SMSConfiguration> {
    const { data, error } = await supabase
      .from('sms_configuration')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // SMS Sending
  async sendSMS(request: SendSMSRequest): Promise<SendSMSResponse> {
    const { data, error } = await supabase.functions.invoke('sms-service', {
      body: request
    });

    if (error) {
      return {
        success: false,
        message: 'Failed to send SMS',
        error: error.message
      };
    }

    return data as SendSMSResponse;
  }

  // SMS for Order Status Updates
  async sendOrderStatusSMS(
    orderId: string, 
    status: string, 
    customerPhone: string, 
    orderData: Record<string, any>
  ): Promise<SendSMSResponse> {
    const templateKey = this.getOrderStatusTemplateKey(status);
    
    if (!templateKey) {
      return {
        success: false,
        message: `No SMS template found for status: ${status}`,
        error: `Unsupported order status for SMS: ${status}`
      };
    }

    return this.sendSMS({
      to: customerPhone,
      template_key: templateKey,
      variables: {
        customer_name: orderData.customer_name || 'Customer',
        order_number: orderData.order_number || orderId,
        total_amount: orderData.total_amount?.toLocaleString() || '0',
        delivery_time: orderData.delivery_time || 'Soon',
        pickup_address: orderData.pickup_address || 'Our location',
        tracking_url: `${window.location.origin}/track/${orderId}`,
        rating_url: `${window.location.origin}/rate/${orderId}`
      },
      order_id: orderId,
      priority: 'normal'
    });
  }

  private getOrderStatusTemplateKey(status: string): string | null {
    const statusMap: Record<string, string> = {
      'confirmed': 'order_confirmed',
      'preparing': 'order_preparing', 
      'ready': 'order_ready',
      'out_for_delivery': 'order_out_for_delivery',
      'delivered': 'order_delivered',
      'cancelled': 'order_cancelled'
    };

    return statusMap[status] || null;
  }

  // SMS Analytics and Monitoring
  async getDeliveryLogs(filters?: {
    order_id?: string;
    status?: string;
    limit?: number;
  }) {
    let query = supabase
      .from('notification_delivery_log')
      .select('*')
      .eq('channel', 'sms')
      .order('created_at', { ascending: false });

    if (filters?.order_id) {
      query = query.eq('order_id', filters.order_id);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getSMSStats(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      const { data, error } = await supabase
        .from('notification_delivery_log')
        .select('status, sms_cost, created_at')
        .eq('channel', 'sms')
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Error fetching SMS stats:', error);
        return {
          total_sent: 0,
          successful: 0,
          failed: 0,
          total_cost: 0,
          success_rate: 0
        };
      }

      const logs = data || [];
      const stats = {
        total_sent: logs.length,
        successful: logs.filter((log: any) => log.status === 'sent').length,
        failed: logs.filter((log: any) => log.status === 'failed').length,
        total_cost: logs.reduce((sum: number, log: any) => sum + (log.sms_cost || 0), 0)
      };

      return {
        ...stats,
        success_rate: stats.total_sent > 0 ? (stats.successful / stats.total_sent) * 100 : 0
      };
    } catch (error) {
      console.error('SMS stats query failed:', error);
      return {
        total_sent: 0,
        successful: 0,
        failed: 0,
        total_cost: 0,
        success_rate: 0
      };
    }
  }
}

export const smsService = new SMSService();