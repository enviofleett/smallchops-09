import { useQuery } from '@tanstack/react-query';
import { useCustomerAuth } from './useCustomerAuth';
import { getCustomerOrderHistory } from '@/api/purchaseHistory';

export const useCustomerOrders = () => {
  const { customerAccount, isAuthenticated } = useCustomerAuth();

  return useQuery({
    queryKey: ['customer-orders', customerAccount?.id],
    queryFn: async () => {
      if (!customerAccount?.id) return { orders: [], count: 0 };
      
      // For now, we'll use email since the API expects it
      // In a production app, you'd want to have the customer email in the customerAccount
      const email = customerAccount.id; // This would need to be the actual email
      return await getCustomerOrderHistory(email, { page: 1, pageSize: 20 });
    },
    enabled: isAuthenticated && !!customerAccount?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};