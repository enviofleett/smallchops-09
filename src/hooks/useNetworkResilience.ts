
import { UseQueryResult } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

interface ResilienceOptions<T> {
  fallbackData?: T;
  onError?: (error: Error) => void;
  showToast?: boolean;
}

export const useNetworkResilience = <T>(
  queryResult: UseQueryResult<T>,
  resilience: ResilienceOptions<T> = {}
) => {
  const { toast } = useToast();

  // Handle errors with toast notifications
  useEffect(() => {
    if (queryResult.isError && queryResult.error) {
      console.error('Network resilience error:', queryResult.error);
      
      if (resilience.showToast !== false) {
        toast({
          title: "Connection Issue",
          description: "Some data might be outdated. We're working to restore the connection.",
          variant: "destructive",
        });
      }
      
      resilience.onError?.(queryResult.error);
    }
  }, [queryResult.isError, queryResult.error, resilience, toast]);

  // Return fallback data if query fails and fallback is provided
  if (queryResult.isError && resilience.fallbackData) {
    return {
      ...queryResult,
      data: resilience.fallbackData,
      isLoading: false,
      isError: false,
    };
  }

  return queryResult;
};
