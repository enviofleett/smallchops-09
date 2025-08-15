import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

// Email request interface - updated to support template-based emails
interface EmailRequest {
  to: string;
  subject?: string; // Optional when using templates
  html?: string;
  text?: string;
  templateId?: string;
  variables?: Record<string, string>;
  emailType?: 'transactional' | 'marketing';
}

// Email template interface that matches the database
interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  subject_template: string;
  html_template: string;
  text_template?: string | null;
  template_type: string;
  is_active: boolean | null;
  variables: string[] | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

// Email delivery log interface that matches smtp_delivery_logs table
interface EmailDeliveryLog {
  id: string;
  email_id?: string | null;
  recipient_email: string;
  sender_email?: string | null;
  subject?: string | null;
  delivery_status: string;
  provider: string;
  error_message?: string | null;
  smtp_response?: string | null;
  email_type?: string | null;
  delivery_timestamp?: string | null;
  created_at: string;
  metadata: any;
}

export const useEmailService = () => {
  const { toast } = useToast();

  // Send email mutation with Auth system priority
  const sendEmailMutation = useMutation({
    mutationFn: async (emailRequest: EmailRequest) => {
      console.log('Sending email with Auth system priority:', emailRequest);
      
      try {
        // Try Supabase Auth email system first (more reliable)
        const { data, error } = await supabase.functions.invoke('supabase-auth-email-sender', {
          body: emailRequest
        });

        if (error) {
          throw new Error(error.message || 'Failed to send email via Auth system');
        }

        console.log('Email sent successfully via Supabase Auth:', data);
        return data;
      } catch (authError) {
        console.warn('Auth email failed, trying SMTP fallback:', authError);
        
        // Fallback to SMTP if Auth system fails
        const { data, error } = await supabase.functions.invoke('smtp-email-sender', {
          body: emailRequest
        });

        if (error) {
          console.error('SMTP fallback also failed:', error);
          throw new Error(`All email systems failed. Auth error: ${authError.message}, SMTP error: ${error.message}`);
        }

        console.log('Email sent successfully via SMTP fallback:', data);
        return data;
      }
    },
    onSuccess: () => {
      toast({
        title: "Email sent successfully",
        description: "Your email has been sent via Auth system",
      });
    },
    onError: (error: any) => {
      console.error('Email sending error:', error);
      toast({
        title: "Email sending failed",
        description: error.message || "Failed to send email",
        variant: "destructive",
      });
    }
  });

  // Email templates query
  const templatesQuery = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enhanced_email_templates')
        .select('*')
        .order('template_type', { ascending: true })
        .order('template_name', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch email templates: ${error.message}`);
      }

      return data || [];
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Email delivery logs query - using smtp_delivery_logs
  const deliveryLogsQuery = useQuery({
    queryKey: ['email-delivery-logs'],
    queryFn: async () => {
      // Get logs from smtp_delivery_logs
      const { data: smtpLogs, error: smtpError } = await supabase
        .from('smtp_delivery_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (smtpError) {
        console.error('Error fetching SMTP logs:', smtpError);
        throw new Error(`Failed to fetch SMTP delivery logs: ${smtpError.message}`);
      }

      return smtpLogs || [];
    },
    refetchOnWindowFocus: false,
    staleTime: 30000, // 30 seconds
  });

  // Helper functions for specific email types
  const sendOrderNotification = async (orderId: string, status: string, customerEmail: string, variables: Record<string, string> = {}) => {
    const templateKey = `order_${status}`;
    
    return sendEmailMutation.mutateAsync({
      templateId: templateKey,
      to: customerEmail,
      variables: {
        orderId,
        orderStatus: status,
        ...variables
      },
      emailType: 'transactional'
    });
  };

  const sendWelcomeEmail = async (customerEmail: string, customerName: string, variables: Record<string, string> = {}) => {
    return sendEmailMutation.mutateAsync({
      templateId: 'user_welcome',
      to: customerEmail,
      variables: {
        customerName,
        ...variables
      },
      emailType: 'transactional'
    });
  };

  const sendCustomEmail = async (emailRequest: EmailRequest) => {
    return sendEmailMutation.mutateAsync(emailRequest);
  };

  return {
    // Email sending
    sendEmail: sendEmailMutation.mutate,
    sendEmailAsync: sendEmailMutation.mutateAsync,
    isSending: sendEmailMutation.isPending,
    sendError: sendEmailMutation.error,

    // Templates
    templates: templatesQuery.data || [],
    isLoadingTemplates: templatesQuery.isLoading,
    templatesError: templatesQuery.error,

    // Delivery logs
    deliveryLogs: deliveryLogsQuery.data || [],
    isLoadingLogs: deliveryLogsQuery.isLoading,
    logsError: deliveryLogsQuery.error,

    // Helper functions
    sendOrderNotification,
    sendWelcomeEmail,
    sendCustomEmail,
  };
};