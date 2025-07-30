import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EmailRequest {
  to: string;
  toName?: string;
  subject?: string;
  html?: string;
  text?: string;
  templateKey?: string;
  variables?: Record<string, any>;
  emailType?: 'marketing' | 'transactional';
  priority?: 'high' | 'normal' | 'low';
  provider?: 'smtp' | 'mailersend' | 'auto';
}

export interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  subject_template: string;
  html_template: string;
  text_template?: string;
  variables: string[];
  template_type: 'order' | 'customer' | 'marketing' | 'admin';
  is_active: boolean;
}

export interface EmailDeliveryLog {
  id: string;
  message_id?: string;
  recipient_email: string;
  sender_email?: string;
  subject?: string;
  delivery_status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed';
  provider: 'smtp' | 'mailersend';
  error_message?: string;
  smtp_response?: string;
  delivery_timestamp?: string;
  created_at: string;
  metadata: Record<string, any>;
}

export const useEmailService = () => {
  const { toast } = useToast();

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (emailRequest: EmailRequest) => {
      const provider = emailRequest.provider || 'auto';
      
      // Determine which service to use
      const functionName = provider === 'smtp' ? 'smtp-email-sender' : 
                          provider === 'mailersend' ? 'send-email-standardized' :
                          'send-email-standardized'; // Default to MailerSend for 'auto'

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          to: emailRequest.to,
          toName: emailRequest.toName,
          subject: emailRequest.subject,
          html: emailRequest.html,
          text: emailRequest.text,
          templateKey: emailRequest.templateKey,
          variables: emailRequest.variables || {},
          emailType: emailRequest.emailType || 'transactional',
          priority: emailRequest.priority || 'normal'
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to send email');
      }

      return data;
    },
    onSuccess: (data, variables) => {
      toast({
        title: 'Email Sent',
        description: `Email successfully sent to ${variables.to}`,
      });
    },
    onError: (error: Error, variables) => {
      toast({
        title: 'Email Failed',
        description: `Failed to send email to ${variables.to}: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Get email templates (fallback to existing communication_events for now)
  const templatesQuery = useQuery({
    queryKey: ['email-templates'],
    queryFn: async (): Promise<EmailTemplate[]> => {
      // Return empty array for now until tables are created
      return [];
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get delivery logs (use existing communication_events for now)
  const deliveryLogsQuery = useQuery({
    queryKey: ['email-delivery-logs'],
    queryFn: async (): Promise<EmailDeliveryLog[]> => {
      const { data, error } = await supabase
        .from('communication_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        return [];
      }

      // Map existing data to delivery log format
      return (data || []).map((event: any) => ({
        id: event.id,
        message_id: event.external_id,
        recipient_email: event.recipient_email,
        subject: event.template_id,
        delivery_status: event.status,
        provider: 'mailersend' as const,
        created_at: event.created_at,
        metadata: event.variables || {}
      }));
    },
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Send order notification email
  const sendOrderNotification = async (
    orderData: {
      customerEmail: string;
      customerName: string;
      orderNumber: string;
      orderStatus: string;
      orderTotal?: number;
      orderDate?: string;
      deliveryAddress?: string;
      pickupAddress?: string;
    },
    provider: 'smtp' | 'mailersend' | 'auto' = 'auto'
  ) => {
    const templateKey = `order_${orderData.orderStatus.toLowerCase()}`;
    
    return sendEmailMutation.mutateAsync({
      to: orderData.customerEmail,
      toName: orderData.customerName,
      templateKey: templateKey,
      variables: {
        customerName: orderData.customerName,
        orderNumber: orderData.orderNumber,
        orderStatus: orderData.orderStatus,
        orderTotal: orderData.orderTotal?.toFixed(2),
        orderDate: orderData.orderDate || new Date().toLocaleDateString(),
        deliveryAddress: orderData.deliveryAddress,
        pickupAddress: orderData.pickupAddress,
      },
      emailType: 'transactional',
      provider
    });
  };

  // Send welcome email
  const sendWelcomeEmail = async (
    customerData: {
      email: string;
      name: string;
    },
    provider: 'smtp' | 'mailersend' | 'auto' = 'auto'
  ) => {
    return sendEmailMutation.mutateAsync({
      to: customerData.email,
      toName: customerData.name,
      templateKey: 'welcome_customer',
      variables: {
        customerName: customerData.name,
      },
      emailType: 'transactional',
      provider
    });
  };

  // Send custom email
  const sendCustomEmail = async (emailRequest: EmailRequest) => {
    return sendEmailMutation.mutateAsync(emailRequest);
  };

  return {
    // Mutations
    sendEmail: sendEmailMutation.mutate,
    sendEmailAsync: sendEmailMutation.mutateAsync,
    sendOrderNotification,
    sendWelcomeEmail,
    sendCustomEmail,
    
    // Queries
    templates: templatesQuery.data || [],
    isLoadingTemplates: templatesQuery.isLoading,
    templatesError: templatesQuery.error,
    
    deliveryLogs: deliveryLogsQuery.data || [],
    isLoadingLogs: deliveryLogsQuery.isLoading,
    logsError: deliveryLogsQuery.error,
    
    // Status
    isSending: sendEmailMutation.isPending,
    sendError: sendEmailMutation.error,
  };
};