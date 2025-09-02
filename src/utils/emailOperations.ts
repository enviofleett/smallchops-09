
import { supabase } from '@/integrations/supabase/client';

export interface EmailOperationResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Production-ready email operations utility
 * Replaces all hardcoded legacy email logic
 */
export class EmailOperations {
  
  /**
   * Queue a transactional email (replaces direct SMTP calls)
   */
  static async queueTransactionalEmail(params: {
    recipient_email: string;
    template_key: string;
    variables?: Record<string, any>;
    priority?: 'low' | 'normal' | 'high';
    event_type?: string;
  }): Promise<EmailOperationResult> {
    try {
      const { data, error } = await supabase
        .from('communication_events')
        .insert({
          event_type: params.event_type || params.template_key,
          template_key: params.template_key,
          recipient_email: params.recipient_email.toLowerCase(),
          variables: params.variables || {},
          priority: params.priority || 'normal',
          status: 'queued',
          email_type: 'transactional'
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        message: 'Email queued successfully',
        data: { event_id: data.id }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to queue email: ${error.message}`
      };
    }
  }

  /**
   * Get email delivery status for a specific recipient
   */
  static async getEmailStatus(recipient_email: string): Promise<EmailOperationResult> {
    try {
      const { data, error } = await supabase
        .from('communication_events')
        .select('status, created_at, sent_at, error_message')
        .eq('recipient_email', recipient_email.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return {
        success: true,
        message: 'Email status retrieved',
        data: data || []
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to get email status: ${error.message}`
      };
    }
  }

  /**
   * Trigger secure email cleanup via admin-only endpoint
   */
  static async triggerEmailCleanup(daysOld: number = 30): Promise<EmailOperationResult> {
    try {
      const { data, error } = await supabase.functions.invoke('email-service-core', {
        body: { 
          action: 'cleanup',
          cleanup_options: { days_old: daysOld }
        }
      });

      if (error) throw error;

      return {
        success: data.success,
        message: data.message,
        data: data.results
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Email cleanup failed: ${error.message}`
      };
    }
  }

  /**
   * Get secure email system statistics
   */
  static async getEmailStats(): Promise<EmailOperationResult> {
    try {
      const { data, error } = await supabase.functions.invoke('email-service-core', {
        body: { action: 'get_stats' }
      });

      if (error) throw error;

      return {
        success: true,
        message: 'Email stats retrieved successfully',
        data: data.stats
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to get email stats: ${error.message}`
      };
    }
  }

  /**
   * Check email system health
   */
  static async checkEmailHealth(): Promise<EmailOperationResult> {
    try {
      const { data, error } = await supabase.functions.invoke('email-service-core', {
        body: { action: 'health_check' }
      });

      if (error) throw error;

      return {
        success: data.success,
        message: `Email system is ${data.health}`,
        data: data
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Email health check failed: ${error.message}`
      };
    }
  }

  /**
   * Test SMTP connection health
   */
  static async testEmailConnection(): Promise<EmailOperationResult> {
    try {
      const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: { healthcheck: true, check: 'smtp' }
      });

      if (error) throw error;

      return {
        success: data?.smtpCheck?.configured || false,
        message: data?.smtpCheck?.configured 
          ? 'SMTP connection healthy' 
          : 'SMTP not configured properly',
        data: data?.smtpCheck
      };
    } catch (error: any) {
      return {
        success: false,
        message: `SMTP test failed: ${error.message}`
      };
    }
  }
}

/**
 * Legacy email sender replacement
 * Use EmailOperations.queueTransactionalEmail() instead
 */
export const sendTransactionalEmail = EmailOperations.queueTransactionalEmail;

/**
 * Legacy email status checker replacement
 * Use EmailOperations.getEmailStatus() instead
 */
export const checkEmailDeliveryStatus = EmailOperations.getEmailStatus;
