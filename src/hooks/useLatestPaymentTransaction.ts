import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PaymentTransaction {
  id: string;
  provider_reference?: string;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string;
  paid_at?: string;
  created_at: string;
  gateway_response?: string;
  provider_response?: any;
}

/**
 * Hook to fetch the latest payment transaction for a specific order
 */
export const useLatestPaymentTransaction = (orderId: string) => {
  return useQuery({
    queryKey: ['latest-payment-transaction', orderId],
    queryFn: async () => {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      const { data, error } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching payment transaction:', error);
        throw error;
      }

      return data as PaymentTransaction | null;
    },
    enabled: !!orderId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false
  });
};