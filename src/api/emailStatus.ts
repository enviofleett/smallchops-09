import { supabase } from "@/integrations/supabase/client";

export interface EmailStatusData {
  email: string;
  status: 'sent' | 'failed' | 'pending' | 'bounced' | 'none';
  sentAt?: string;
  lastAttempt?: string;
}

// Get email status for customers
export const getCustomerEmailStatuses = async (customerEmails: string[]): Promise<Record<string, EmailStatusData>> => {
  try {
    if (customerEmails.length === 0) return {};

    // Get communication events for these customers
    const { data: events, error } = await supabase
      .from('communication_events')
      .select('recipient_email, status, sent_at, updated_at, event_type')
      .in('recipient_email', customerEmails)
      .eq('event_type', 'customer_welcome')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map email statuses
    const statusMap: Record<string, EmailStatusData> = {};
    
    customerEmails.forEach(email => {
      statusMap[email] = { email, status: 'none' };
    });

    events?.forEach(event => {
      if (!statusMap[event.recipient_email]) {
        statusMap[event.recipient_email] = { email: event.recipient_email, status: 'none' };
      }
      
      // Map communication event status to our email status
      let emailStatus: EmailStatusData['status'] = 'none';
      const statusStr = event.status as string;
      
      if (statusStr === 'sent' || statusStr === 'delivered') {
        emailStatus = 'sent';
      } else if (statusStr === 'failed') {
        emailStatus = 'failed';
      } else if (statusStr === 'queued' || statusStr === 'processing') {
        emailStatus = 'pending';
      } else if (statusStr === 'bounced' || statusStr === 'spam_complaint') {
        emailStatus = 'bounced';
      } else {
        emailStatus = 'none';
      }

      statusMap[event.recipient_email] = {
        email: event.recipient_email,
        status: emailStatus,
        sentAt: event.sent_at || undefined,
        lastAttempt: event.updated_at
      };
    });

    return statusMap;
  } catch (error) {
    console.error('Error fetching email statuses:', error);
    return {};
  }
};

// Resend welcome email for a customer
export const resendWelcomeEmail = async (customerEmail: string): Promise<boolean> => {
  try {
    const { error } = await supabase.functions.invoke('unified-smtp-sender', {
      body: {
        to: customerEmail,
        templateKey: 'customer_welcome',
        variables: {
          customerName: customerEmail.split('@')[0], // Fallback name
          companyName: 'Starters Small Chops',
          supportEmail: 'support@startersmallchops.com',
          websiteUrl: window.location.origin,
          siteUrl: window.location.origin
        },
        emailType: 'transactional'
      }
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error resending welcome email:', error);
    return false;
  }
};

// Requeue all failed emails (admin action)
export const requeueFailedEmails = async (): Promise<{ success: boolean; count: number }> => {
  try {
    const { data, error } = await supabase.rpc('requeue_failed_welcome_emails');
    
    if (error) throw error;
    
    return { success: true, count: data || 0 };
  } catch (error) {
    console.error('Error requeuing failed emails:', error);
    return { success: false, count: 0 };
  }
};