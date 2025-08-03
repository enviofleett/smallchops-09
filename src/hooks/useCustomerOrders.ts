import { useQuery } from '@tanstack/react-query';
import { useCustomerAuth } from './useCustomerAuth';
import { getCustomerOrderHistory } from '@/api/purchaseHistory';

export const useCustomerOrders = () => {
  const { customerAccount, isAuthenticated, user } = useCustomerAuth();

  return useQuery({
    queryKey: ['customer-orders', user?.email],
    queryFn: async () => {
      if (!user?.email) return { orders: [], count: 0 };
      
      return await getCustomerOrderHistory(user.email, { page: 1, pageSize: 20 });
    },
    enabled: isAuthenticated && !!user?.email,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};