
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface ResilienceOptions<T> {
  fallbackData?: T;
  onError?: (error: Error) => void;
  showToast?: boolean;
}

export const useNetworkResilience = <T>(
  queryOptions: UseQueryOptions<T>,
  resilience: ResilienceOptions<T> = {}
) => {
  const { toast } = useToast();

  const enhancedQuery = useQuery({
    ...queryOptions,
    retry: (failureCount, error) => {
      // Custom retry logic
      if (failureCount < 3) {
        console.warn(`Query retry ${failureCount + 1}/3:`, error);
        return true;
      }
      return false;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error: Error) => {
      console.error('Network resilience error:', error);
      
      if (resilience.showToast !== false) {
        toast({
          title: "Connection Issue",
          description: "Some data might be outdated. We're working to restore the connection.",
          variant: "destructive",
        });
      }
      
      resilience.onError?.(error);
    },
  });

  // Return fallback data if query fails and fallback is provided
  if (enhancedQuery.isError && resilience.fallbackData) {
    return {
      ...enhancedQuery,
      data: resilience.fallbackData,
      isLoading: false,
      isError: false,
    };
  }

  return enhancedQuery;
};
