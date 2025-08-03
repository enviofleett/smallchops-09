import { useQuery } from '@tanstack/react-query';
import { useCustomerAuth } from './useCustomerAuth';
import { getCustomerOrderHistory } from '@/api/purchaseHistory';

export const useCustomerOrders = () => {
  const { isAuthenticated, user } = useCustomerAuth();

  return useQuery({
    queryKey: ['customer-orders', user?.email],
    queryFn: async () => {
      if (!user?.email) {
        return { orders: [], count: 0 };
      }
      
      try {
        const result = await getCustomerOrderHistory(user.email, { page: 1, pageSize: 20 });
        
        if (!result || typeof result !== 'object') {
          return { orders: [], count: 0 };
        }
        
        return {
          orders: Array.isArray(result.orders) ? result.orders : [],
          count: typeof result.count === 'number' ? result.count : 0
        };
      } catch (error) {
        console.error('Error fetching orders:', error);
        return { orders: [], count: 0 };
      }
    },
    enabled: isAuthenticated && !!user?.email,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  });
};