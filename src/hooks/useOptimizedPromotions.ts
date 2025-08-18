
import { useQuery } from '@tanstack/react-query';
import { getPromotions } from '@/api/promotions';

// Centralized promotions hook to avoid duplicate fetches
export const useOptimizedPromotions = () => {
  return useQuery({
    queryKey: ['promotions', 'active'],
    queryFn: getPromotions,
    staleTime: 10 * 60 * 1000, // 10 minutes - promotions don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
};
