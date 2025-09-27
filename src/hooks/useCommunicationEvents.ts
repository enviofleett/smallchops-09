import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CommunicationEvent {
  id: string;
  event_type: string;
  recipient_email: string | null;
  template_key: string | null;
  status: 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled';
  created_at: string;
  sent_at: string | null;
  error_message: string | null;
  template_variables: any;
  order_id: string | null;
}

export const useCommunicationEvents = (orderId: string) => {
  return useQuery({
    queryKey: ['communication-events', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_events')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CommunicationEvent[];
    },
    enabled: !!orderId,
  });
};

export const useManualCommunication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      orderId, 
      type, 
      recipient, 
      template 
    }: { 
      orderId: string; 
      type: string; 
      recipient: string; 
      template: string; 
    }) => {
      const { data, error } = await supabase
        .from('communication_events')
        .insert({
          event_type: type,
          recipient_email: recipient,
          template_key: template,
          order_id: orderId,
          status: 'queued' as const,
          template_variables: {},
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      toast.success('Communication queued successfully');
      queryClient.invalidateQueries({ queryKey: ['communication-events', variables.orderId] });
    },
    onError: (error: any) => {
      console.error('Manual communication failed:', error);
      toast.error('Failed to send communication');
    }
  });
};