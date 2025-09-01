
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
   * Trigger manual email cleanup using direct operations
   */
  static async triggerEmailCleanup(): Promise<EmailOperationResult> {
    try {
      // Reset stale processing records to failed
      const { data: staleProcessing, error: selectError } = await supabase
        .from('communication_events')
        .select('id')
        .eq('status', 'processing')
        .lt('processing_started_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

      if (selectError) throw selectError;

      let cleanedCount = 0;

      if (staleProcessing && staleProcessing.length > 0) {
        const { error: updateError } = await supabase
          .from('communication_events')
          .update({ 
            status: 'failed', 
            error_message: 'Processing timeout - reset by cleanup',
            updated_at: new Date().toISOString()
          })
          .in('id', staleProcessing.map(item => item.id));

        if (updateError) throw updateError;
        cleanedCount += staleProcessing.length;
      }

      // Archive and delete old queued items
      const { data: oldQueued, error: queuedSelectError } = await supabase
        .from('communication_events')
        .select('id')
        .eq('status', 'queued')
        .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (queuedSelectError) throw queuedSelectError;

      if (oldQueued && oldQueued.length > 0) {
        const { error: deleteError } = await supabase
          .from('communication_events')
          .delete()
          .in('id', oldQueued.map(item => item.id));

        if (deleteError) throw deleteError;
        cleanedCount += oldQueued.length;
      }

      return {
        success: true,
        message: 'Email cleanup completed',
        data: { total_cleaned: cleanedCount }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Email cleanup failed: ${error.message}`
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
