import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPromotions, type Promotion } from '@/api/promotions';
import { isPromotionValidForCurrentDay } from '@/lib/discountCalculations';

// Production-ready promotions hook that won't block the main app
export function useProductionPromotions() {
  const queryClient = useQueryClient();

  const {
    data: allPromotions = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['promotions', 'production'],
    queryFn: getPromotions,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
  });

  // Filter for valid, active promotions
  const activePromotions = allPromotions.filter((promotion: Promotion) => {
    try {
      return (
        promotion.status === 'active' &&
        isPromotionValidForCurrentDay(promotion)
      );
    } catch (error) {
      console.warn('Error filtering promotion:', error);
      return false;
    }
  });

  // Get promotions applicable to specific days
  const getPromotionsForDay = (dayOfWeek: string) => {
    return allPromotions.filter((promotion: Promotion) => {
      try {
        if (!promotion.applicable_days || promotion.applicable_days.length === 0) {
          return true; // Applies to all days
        }
        return promotion.applicable_days.includes(dayOfWeek.toLowerCase());
      } catch (error) {
        console.warn('Error checking promotion day:', error);
        return false;
      }
    });
  };

  return {
    allPromotions,
    activePromotions,
    getPromotionsForDay,
    isLoading,
    error,
    refetch,
  };
}