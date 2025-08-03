import { useQuery } from '@tanstack/react-query';
import { useCustomerAuth } from './useCustomerAuth';
import { getCustomerOrderHistory } from '@/api/purchaseHistory';

export const useCustomerOrders = () => {
  const { customerAccount, isAuthenticated, user, error: authError } = useCustomerAuth();

  return useQuery({
    queryKey: ['customer-orders', user?.email],
    queryFn: async () => {
      try {
        if (!user?.email) {
          console.warn('No user email available for orders query');
          return { orders: [], count: 0 };
        }
        
        const result = await getCustomerOrderHistory(user.email, { page: 1, pageSize: 20 });
        
        // Validate the result structure
        if (!result || typeof result !== 'object') {
          console.error('Invalid orders response:', result);
          return { orders: [], count: 0 };
        }
        
        return {
          orders: Array.isArray(result.orders) ? result.orders : [],
          count: typeof result.count === 'number' ? result.count : 0
        };
      } catch (error) {
        console.error('Error in customer orders query:', error);
        throw error;
      }
    },
    enabled: isAuthenticated && !!user?.email && !authError,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error?.message?.includes('auth') || error?.message?.includes('permission')) {
        return false;
      }
      return failureCount < 2; // Retry up to 2 times for other errors
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
};