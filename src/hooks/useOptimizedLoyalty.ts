import { useQuery } from '@tanstack/react-query';

// Optimized loyalty hook to prevent blocking main app loading
export const useOptimizedLoyalty = (customerEmail?: string) => {
  return useQuery({
    queryKey: ['loyalty', customerEmail],
    queryFn: async () => {
      // Return mock data for now - replace with actual API call when needed
      return {
        pointsBalance: 0,
        currentTier: 'bronze' as const,
        pointsToNextTier: 100,
        lifetimePoints: 0
      };
    },
    enabled: !!customerEmail,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    retryDelay: 1000,
  });
};