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

  // Send email mutation with standardized payload
  const sendEmailMutation = useMutation({
    mutationFn: async (emailRequest: EmailRequest) => {
      console.log('🚀 Sending email via unified SMTP sender:', emailRequest);
      
      try {
        // Normalize payload for consistent API
        const normalizedPayload = {
          to: emailRequest.to,
          subject: emailRequest.subject,
          textContent: emailRequest.text,
          htmlContent: emailRequest.html,
          templateKey: emailRequest.templateId,
          variables: emailRequest.variables || {},
          emailType: emailRequest.emailType || 'transactional'
        };

        console.log('📤 Normalized payload:', normalizedPayload);

        const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
          body: normalizedPayload
        });

        if (error) {
          console.error('❌ Supabase function error:', error);
          throw new Error(`Email sending failed: ${error.message}`);
        }

        // Handle both success/error response formats
        if (data && !data.success && data.error) {
          throw new Error(`SMTP Error: ${data.error}`);
        }

        console.log('✅ Email sent successfully:', data);
        return data;
      } catch (error) {
        console.error('💥 Email sending failed:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Email sent successfully",
        description: "Your email has been sent successfully",
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

  // Email health monitoring query
  const emailHealthQuery = useQuery({
    queryKey: ['email-health-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_email_delivery_metrics', { p_hours_back: 24 });

      if (error) {
        throw new Error(`Failed to fetch email health metrics: ${error.message}`);
      }

      return data;
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Manual failure alert trigger
  const triggerFailureAlert = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('email-failure-alerting');

      if (error) {
        throw new Error(`Failed to trigger failure alert: ${error.message}`);
      }

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Alert check completed",
        description: `${data.alertsSent || 0} alerts sent`,
        variant: data.alertsSent > 0 ? "destructive" : "default",
      });
    },
    onError: (error) => {
      console.error('Manual alert trigger error:', error);
      toast({
        title: "Alert trigger failed",
        description: error.message || "Failed to trigger failure alert",
        variant: "destructive",
      });
    }
  });

  return {
    // Email sending
    sendEmail: sendEmailMutation.mutateAsync,
    isSending: sendEmailMutation.isPending,
    sendingError: sendEmailMutation.error,

    // Templates
    templates: templatesQuery.data || [],
    isLoadingTemplates: templatesQuery.isLoading,
    templatesError: templatesQuery.error,

    // Delivery logs
    deliveryLogs: deliveryLogsQuery.data || [],
    isLoadingLogs: deliveryLogsQuery.isLoading,
    logsError: deliveryLogsQuery.error,

    // Email health monitoring
    emailHealth: emailHealthQuery.data,
    isLoadingHealth: emailHealthQuery.isLoading,
    healthError: emailHealthQuery.error,
    triggerFailureAlert: triggerFailureAlert.mutateAsync,
    isCheckingAlerts: triggerFailureAlert.isPending,

    // Helper functions
    sendOrderNotification,
    sendWelcomeEmail,
    sendCustomEmail,
  };
};